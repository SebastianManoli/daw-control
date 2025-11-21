const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const { dialog } = require('electron');

const execPromise = util.promisify(exec);

/**
 * Initialize a git repository in the specified folder
 * Creates .gitignore, .gitattributes, and configures git filters
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

    dialog.showMessageBox({
      type: 'info',
      title: 'Repository Initialized',
      message: 'Git repository successfully initialized!',
      detail: 'Created .gitignore, .gitattributes, and configured git filters.'
    });

    return { success: true };
  } catch (error) {
    console.error('Error initializing git:', error);
    dialog.showErrorBox('Git Initialization Error', `Failed to initialize git repository: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { initializeGitRepository };
