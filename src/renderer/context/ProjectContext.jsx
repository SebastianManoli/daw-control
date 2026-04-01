import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useElectron } from '../hooks/useElectron';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [commits, setCommits] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [headCommit, setHeadCommit] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [changedFiles, setChangedFiles] = useState([]);
  const [selectedChangedFilePath, setSelectedChangedFilePath] = useState(null);
  const [workingFileDiff, setWorkingFileDiff] = useState(null);
  const [workingFileDiffLoading, setWorkingFileDiffLoading] = useState(false);
  const [workingFileDiffError, setWorkingFileDiffError] = useState(null);
  const [workingParsedData, setWorkingParsedData] = useState(null);
  const [workingParsedDataLoading, setWorkingParsedDataLoading] = useState(false);

  const electron = useElectron();
  const isProjectOpen = !!projectPath;

  const clearSelectedChangedFile = useCallback(() => {
    setSelectedChangedFilePath(null);
    setWorkingFileDiff(null);
    setWorkingFileDiffError(null);
    setWorkingFileDiffLoading(false);
  }, []);

  const loadWorkingFileDiff = useCallback(async (filePath, fileStatus) => {
    if (!isProjectOpen || !filePath) {
      return { success: false, error: 'No project or file selected' };
    }

    setWorkingFileDiffLoading(true);
    setWorkingFileDiffError(null);

    const result = await electron.getWorkingFileDiff(filePath, fileStatus);

    if (result.success) {
      setWorkingFileDiff(result);
    } else {
      setWorkingFileDiff(null);
      setWorkingFileDiffError(result.error || 'Failed to load file diff');
    }

    setWorkingFileDiffLoading(false);
    return result;
  }, [electron, isProjectOpen]);

  const loadWorkingParsedData = useCallback(async () => {
    if (!isProjectOpen) return;
    setWorkingParsedDataLoading(true);
    const result = await electron.parseWorkingFile();
    if (result.success) {
      setWorkingParsedData(result.data);
    }
    setWorkingParsedDataLoading(false);
  }, [electron, isProjectOpen]);

  const syncSelectedChangedFile = useCallback(async (files) => {
    if (!selectedChangedFilePath) return;

    const selectedFile = files.find((file) => file.path === selectedChangedFilePath);
    if (!selectedFile) {
      clearSelectedChangedFile();
      return;
    }

    await loadWorkingFileDiff(selectedFile.path, selectedFile.status);
  }, [clearSelectedChangedFile, loadWorkingFileDiff, selectedChangedFilePath]);

  const loadCommits = useCallback(async () => {
    if (!isProjectOpen) return;

    setIsLoading(true);
    const result = await electron.getCommits();
    if (result.success) {
      setCommits(result.commits);
      if (result.headCommit) setHeadCommit(result.headCommit);
    }
    setIsLoading(false);
  }, [electron, isProjectOpen]);

  const loadChangedFiles = useCallback(async () => {
    if (!isProjectOpen) return;
    const result = await electron.getChangedFiles();
    if (result.success) {
      setChangedFiles(result.files);
      await syncSelectedChangedFile(result.files);
    }
  }, [electron, isProjectOpen, syncSelectedChangedFile]);

  // Subscribe to file watcher events from the main process
  useEffect(() => {
    electron.onChangedFilesUpdated(async (data) => {
      if (data.success) {
        setChangedFiles(data.files);
        await syncSelectedChangedFile(data.files);
        await loadWorkingParsedData();
      }
    });

    return () => {
      electron.offChangedFilesUpdated();
    };
  }, [electron, syncSelectedChangedFile, loadWorkingParsedData]);

  const openProject = useCallback(async () => {
    try {
      console.log('Open Project clicked');
      const result = await electron.selectFolder();
      console.log('selectFolder result:', result);

      if (result?.success) {
        const folderName = result.path.split(/[\\/]/).pop();
        setProjectName(folderName);
        setProjectPath(result.path);
        clearSelectedChangedFile();

        // Load commits after opening project
        setIsLoading(true);
        const commitsResult = await electron.getCommits();
        console.log('getCommits result:', commitsResult);

        if (commitsResult?.success) {
          setCommits(commitsResult.commits || []);
          if (commitsResult.headCommit) setHeadCommit(commitsResult.headCommit);
        }

        // Load changed files
        const changedResult = await electron.getChangedFiles();
        if (changedResult?.success) {
          setChangedFiles(changedResult.files);
        }

        // Parse current working ALS file for live project view
        const workingParseResult = await electron.parseWorkingFile();
        if (workingParseResult?.success) {
          setWorkingParsedData(workingParseResult.data);
        }

        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error opening project:', error);
      setIsLoading(false);
    }
  }, [clearSelectedChangedFile, electron]);

  const selectChangedFile = useCallback(async (file) => {
    if (!file?.path) {
      clearSelectedChangedFile();
      return { success: false, error: 'Invalid file selection' };
    }

    setSelectedChangedFilePath(file.path);
    return await loadWorkingFileDiff(file.path, file.status);
  }, [clearSelectedChangedFile, loadWorkingFileDiff]);

  const createVersion = useCallback(async (message) => {
    if (!isProjectOpen || !message.trim()) return { success: false };

    setIsLoading(true);
    const result = await electron.createVersion(message);
    if (result.success) {
      await loadCommits();
      await loadChangedFiles();
    }
    setIsLoading(false);
    return result;
  }, [electron, isProjectOpen, loadCommits, loadChangedFiles]);

  const restoreVersion = useCallback(async (commitHash) => {
    if (!isProjectOpen) return { success: false };

    setIsLoading(true);
    const result = await electron.restoreCommit(commitHash);
    if (result.success) {
      await loadCommits();
      setHeadCommit(commitHash);
      await loadChangedFiles();
    }
    setIsLoading(false);
    return result;
  }, [electron, isProjectOpen, loadCommits, loadChangedFiles]);

  const parseVersion = useCallback(async (commitHash) => {
    if (!isProjectOpen) return { success: false };

    const result = await electron.parseCommit(commitHash);
    if (result.success) {
      setSelectedCommit(commitHash);
      setParsedData(result.data);
    }
    return result;
  }, [electron, isProjectOpen]);

  const value = {
    // State
    projectName,
    projectPath,
    commits,
    isLoading,
    isProjectOpen,
    selectedCommit,
    headCommit,
    parsedData,
    changedFiles,
    selectedChangedFilePath,
    workingFileDiff,
    workingFileDiffLoading,
    workingFileDiffError,
    workingParsedData,
    workingParsedDataLoading,

    // Actions
    openProject,
    createVersion,
    restoreVersion,
    parseVersion,
    selectChangedFile,
    loadCommits,
    loadChangedFiles,
    setSelectedCommit,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
