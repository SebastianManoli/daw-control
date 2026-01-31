const { spawn } = require('child_process');
const path = require('path');

/**
 * Parse ALS XML content using the Python parser.
 * Pipes the XML content to the parser via stdin and returns parsed JSON.
 *
 * @param {string} xmlContent - The decompressed ALS XML content
 * @param {string} projectName - The project name to include in the output
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function parseAlsContent(xmlContent, projectName = 'Unknown') {
  return new Promise((resolve) => {
    // Path to the parser script (relative to project root)
    const parserPath = path.join(__dirname, '..', '..', 'parser', 'als_parser.py');

    // Spawn Python process
    const pythonProcess = spawn('python', [parserPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Collect stdout data
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr data
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Parser process exited with code:', code);
        console.error('Parser stderr:', stderr);
        resolve({
          success: false,
          error: `Parser exited with code ${code}: ${stderr}`
        });
        return;
      }

      try {
        const parsedData = JSON.parse(stdout);
        // Override project name if provided
        if (projectName !== 'Unknown') {
          parsedData.project_name = projectName;
        }
        resolve({
          success: true,
          data: parsedData
        });
      } catch (parseError) {
        console.error('Failed to parse JSON output:', parseError);
        console.error('Raw stdout:', stdout);
        resolve({
          success: false,
          error: `Failed to parse JSON: ${parseError.message}`
        });
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error('Failed to spawn parser process:', error);
      resolve({
        success: false,
        error: `Failed to spawn parser: ${error.message}`
      });
    });

    // Write XML content to stdin and close it
    pythonProcess.stdin.write(xmlContent);
    pythonProcess.stdin.end();
  });
}

/**
 * Parse an ALS file directly from disk.
 *
 * @param {string} filePath - Path to the .als file
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function parseAlsFile(filePath) {
  return new Promise((resolve) => {
    const parserPath = path.join(__dirname, '..', '..', 'parser', 'als_parser.py');
    const projectName = path.basename(filePath);

    // Spawn Python process with file path argument
    const pythonProcess = spawn('python', [parserPath, filePath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Parser process exited with code:', code);
        console.error('Parser stderr:', stderr);
        resolve({
          success: false,
          error: `Parser exited with code ${code}: ${stderr}`
        });
        return;
      }

      try {
        const parsedData = JSON.parse(stdout);
        resolve({
          success: true,
          data: parsedData
        });
      } catch (parseError) {
        console.error('Failed to parse JSON output:', parseError);
        resolve({
          success: false,
          error: `Failed to parse JSON: ${parseError.message}`
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to spawn parser process:', error);
      resolve({
        success: false,
        error: `Failed to spawn parser: ${error.message}`
      });
    });
  });
}

module.exports = { parseAlsContent, parseAlsFile };
