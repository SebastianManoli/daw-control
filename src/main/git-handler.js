const path = require('path'); // directory path utility
const fs = require('fs').promises; // file system module for reading + writing files
const { exec } = require('child_process'); // Runs shell commands from within Node.js
const util = require('util'); // Utility functions like promises and callbacks
const { dialog } = require('electron'); // native electron dialog

const execPromise = util.promisify(exec);

/**
 * Create a git commit in the specified folder
 * @param {string} folderPath - Path to the git repository
 * @param {string} message - Commit message
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function createCommit(folderPath, message) {
  try {
    // Stage all changes
    await execPromise('git add .', { cwd: folderPath });
    console.log('Files staged for commit');

    // Create commit
    await execPromise(`git commit -m "${message}"`, { cwd: folderPath });
    console.log(`Commit created: ${message}`);

    return { success: true };
  } catch (error) {
    console.error('Error creating commit:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize a git repository in the specified folder
 * Creates .gitignore, .gitattributes, configures git filters, and creates initial commit
 * @param {string} folderPath
 */
async function initializeGitRepository(folderPath) {
  try {
    // Check if git repository already exists
    const gitDirPath = path.join(folderPath, '.git');
    let alreadyInitialized = false;

    try {
      const stats = await fs.stat(gitDirPath);
      if (stats.isDirectory()) {
        alreadyInitialized = true;
        console.log('Git repository already exists, skipping initialization');
      }
    } catch (error) {
      // .git directory doesn't exist, proceed with initialization
      alreadyInitialized = false;
    }

    // Only run git init if not already initialized
    if (!alreadyInitialized) {
      await execPromise('git init', { cwd: folderPath });
      console.log('Git repository initialized');
      // Create .gitignore
      const gitignoreContent = await fs.readFile(path.join(__dirname, 'text/gitignore.txt'));
      const gitignorePath = path.join(folderPath, '.gitignore');
      await fs.writeFile(gitignorePath, gitignoreContent);
      console.log('.gitignore created');
  
      // Create .gitattributes
      const gitattributesContent = await fs.readFile(path.join(__dirname, 'text/gitattributes.txt'));
      const gitattributesPath = path.join(folderPath, '.gitattributes');
      await fs.writeFile(gitattributesPath, gitattributesContent);
      console.log('.gitattributes created');
  
      // Append to .git/config
      const gitConfigContent = await fs.readFile(path.join(__dirname, 'text/gitconfig.txt'));
      const gitConfigPath = path.join(folderPath, '.git/config');
      await fs.appendFile(gitConfigPath, gitConfigContent);
      console.log('.git/config updated with zcat filter configuration');
  
      // Create initial commit
      const commitResult = await createCommit(folderPath, 'Initial commit');
  
      if (!commitResult.success) {
        dialog.showErrorBox('Commit Error', `Repository initialized but failed to create initial commit: ${commitResult.error}`);
        return { success: false, error: commitResult.error };
      }
  
      dialog.showMessageBox({
        type: 'info',
        title: 'Repository Initialized',
        message: 'Git repository successfully initialized!',
        detail: 'Created .gitignore, .gitattributes, configured git filters, and created initial commit.'
      });
    }


    return { success: true };
  } catch (error) {
    console.error('Error initializing git:', error);
    dialog.showErrorBox('Git Initialization Error', `Failed to initialize git repository: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Check if working directory has uncommitted changes
 * @param {string} folderPath - Path to the git repository
 * @returns {Promise<{hasChanges: boolean, files?: string[]}>}
 */
async function checkWorkingDirectoryStatus(folderPath) {
  try {
    const { stdout } = await execPromise('git status --porcelain', { cwd: folderPath });

    if (stdout.trim()) {
      const files = stdout.trim().split('\n').map(line => line.substring(3));
      return { hasChanges: true, files };
    }

    return { hasChanges: false, files: [] };
  } catch (error) {
    console.error('Error checking working directory:', error);
    return { hasChanges: false, files: [] };
  }
}

/**
 * Restore project to a specific commit (leaves files uncommitted in working directory)
 * @param {string} folderPath - Path to the git repository
 * @param {string} commitHash - Hash of commit to restore to
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function restoreCommit(folderPath, commitHash) {
  try {
    // Restore files from the target commit (doesn't create a commit)
    await execPromise(`git checkout ${commitHash} -- .`, { cwd: folderPath });
    console.log(`Restored files from commit ${commitHash} (uncommitted)`);

    return { success: true };
  } catch (error) {
    console.error('Error restoring commit:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Discard uncommitted changes in working directory
 * @param {string} folderPath - Path to the git repository
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function discardChanges(folderPath) {
  try {
    await execPromise('git checkout -- .', { cwd: folderPath });
    console.log('Discarded uncommitted changes');
    return { success: true };
  } catch (error) {
    console.error('Error discarding changes:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get commit history for a repository
 * @param {string} folderPath - Path to the git repository
 * @param {number} limit - Maximum number of commits to retrieve (default: 50)
 * @returns {Promise<{success: boolean, commits?: Array, error?: string}>}
 */
async function getCommitHistory(folderPath, limit = 50) {
  try {
    // Get git log with formatted output
    const { stdout } = await execPromise(
      `git log --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso -n ${limit}`,
      { cwd: folderPath }
    );

    if (!stdout) {
      // No commits yet
      return { success: true, commits: [] };
    }

    // Parse the output into commit objects
    const commits = stdout.split('\n').map(line => {
      const [hash, author, email, date, message] = line.split('|');
      return {
        hash: hash,
        shortHash: hash.substring(0, 7),
        author: author,
        email: email,
        date: new Date(date),
        message: message
      };
    });

    return { success: true, commits };
  } catch (error) {
    console.error('Error getting commit history:', error);
    return { success: false, error: error.message, commits: [] };
  }
}

/**
 * Find the .als file in a project folder
 * @param {string} folderPath - Path to the project folder
 * @returns {Promise<{success: boolean, alsPath?: string, alsName?: string, error?: string}>}
 */
async function findAlsFile(folderPath) {
  try {
    const files = await fs.readdir(folderPath);
    const alsFile = files.find(file => path.extname(file).toLowerCase() === '.als');

    if (alsFile) {
      return {
        success: true,
        alsPath: alsFile,  // Relative path (just filename)
        alsName: alsFile
      };
    }

    return { success: false, error: 'No .als file found in project' };
  } catch (error) {
    console.error('Error finding ALS file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get file content from a specific commit
 * Uses git show to retrieve file content at a specific commit hash.
 * Note: With zcat filter configured, .als files are stored uncompressed,
 * so git show returns the raw XML.
 *
 * @param {string} folderPath - Path to the git repository
 * @param {string} commitHash - Hash of the commit
 * @param {string} filePath - Path to the file (relative to repo root)
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
async function getFileAtCommit(folderPath, commitHash, filePath) {
  try {
    // Use git show to get file content at specific commit
    // maxBuffer increased for large ALS files
    const { stdout } = await execPromise(
      `git show ${commitHash}:"${filePath}"`,
      {
        cwd: folderPath,
        maxBuffer: 50 * 1024 * 1024  // 50MB buffer for large files
      }
    );

    return {
      success: true,
      content: stdout
    };
  } catch (error) {
    console.error('Error getting file at commit:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get list of changed files with their status (added, modified, deleted)
 * Parses `git status --porcelain` output for both staged and unstaged changes
 * @param {string} folderPath - Path to the git repository
 * @returns {Promise<{success: boolean, files: Array<{path: string, status: string}>}>}
 */
async function getChangedFiles(folderPath) {
  try {
    const { stdout } = await execPromise('git status --porcelain', {
      cwd: folderPath,
      maxBuffer: 10 * 1024 * 1024
    });

    console.log('git status --porcelain output:', JSON.stringify(stdout));

    if (!stdout.trim()) {
      return { success: true, files: [] };
    }

    const files = stdout.trim().split('\n').map(line => {
      const x = line[0]; // staging area status
      const y = line[1]; // working tree status
      const filePath = line.substring(3);

      let status;
      if (x === '?' || x === 'A') {
        status = 'added';
      } else if (x === 'D' || y === 'D') {
        status = 'deleted';
      } else {
        status = 'modified';
      }

      return { path: filePath, status };
    });

    return { success: true, files };
  } catch (error) {
    console.error('Error getting changed files:', error);
    return { success: true, files: [] };
  }
}

/**
 * Get the current HEAD commit hash
 * @param {string} folderPath - Path to the git repository
 * @returns {Promise<{success: boolean, hash?: string, error?: string}>}
 */
async function getHeadCommitHash(folderPath) {
  try {
    const { stdout } = await execPromise('git rev-parse HEAD', { cwd: folderPath });
    return { success: true, hash: stdout.trim() };
  } catch (error) {
    console.error('Error getting HEAD commit hash:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeGitRepository,
  createCommit,
  getCommitHistory,
  restoreCommit,
  checkWorkingDirectoryStatus,
  discardChanges,
  findAlsFile,
  getFileAtCommit,
  getHeadCommitHash,
  getChangedFiles
};
