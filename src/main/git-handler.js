const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const { dialog } = require('electron');

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
 * Restore project to a specific commit
 * @param {string} folderPath - Path to the git repository
 * @param {string} commitHash - Hash of commit to restore to
 * @param {boolean} autoCommit - Whether to automatically commit after restore
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function restoreCommit(folderPath, commitHash, autoCommit = true) {
  try {
    // Check for uncommitted changes
    const status = await checkWorkingDirectoryStatus(folderPath);

    if (status.hasChanges) {
      return {
        success: false,
        error: 'You have uncommitted changes. Please commit or discard them first.',
        uncommittedFiles: status.files
      };
    }

    // Restore files from the target commit
    await execPromise(`git checkout ${commitHash} -- .`, { cwd: folderPath });
    console.log(`Restored files from commit ${commitHash}`);

    if (autoCommit) {
      // Create a new commit with the restored state
      const shortHash = commitHash.substring(0, 7);
      const commitMessage = `Restored to version ${shortHash}`;

      const commitResult = await createCommit(folderPath, commitMessage);

      if (!commitResult.success) {
        return { success: false, error: `Restored files but failed to commit: ${commitResult.error}` };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error restoring commit:', error);
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

module.exports = { initializeGitRepository, createCommit, getCommitHistory, restoreCommit, checkWorkingDirectoryStatus };
