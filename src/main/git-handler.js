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
    // Call git init command
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

    return { success: true };
  } catch (error) {
    console.error('Error initializing git:', error);
    dialog.showErrorBox('Git Initialization Error', `Failed to initialize git repository: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { initializeGitRepository, createCommit };
