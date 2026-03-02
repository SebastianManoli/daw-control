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

  const electron = useElectron();
  const isProjectOpen = !!projectPath;

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
    }
  }, [electron, isProjectOpen]);

  // Subscribe to file watcher events from the main process
  useEffect(() => {
    electron.onChangedFilesUpdated((data) => {
      if (data.success) {
        setChangedFiles(data.files);
      }
    });

    return () => {
      electron.offChangedFilesUpdated();
    };
  }, [electron]);

  const openProject = useCallback(async () => {
    try {
      console.log('Open Project clicked');
      const result = await electron.selectFolder();
      console.log('selectFolder result:', result);

      if (result?.success) {
        const folderName = result.path.split(/[\\/]/).pop();
        setProjectName(folderName);
        setProjectPath(result.path);

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

        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error opening project:', error);
      setIsLoading(false);
    }
  }, [electron]);

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

    // Actions
    openProject,
    createVersion,
    restoreVersion,
    parseVersion,
    loadCommits,
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
