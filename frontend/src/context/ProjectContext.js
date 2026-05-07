import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const ProjectContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const ProjectProvider = ({ children }) => {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const list = response.data.projects;
      setProjects(list);

      // Auto-select first project if none selected or current was deleted
      if (list.length > 0) {
        const saved = localStorage.getItem('selectedProject');
        const found = saved ? list.find(p => p.slug === saved) : null;
        if (found) {
          setSelectedProject(found);
        } else {
          setSelectedProject(list[0]);
          localStorage.setItem('selectedProject', list[0].slug);
        }
      } else {
        setSelectedProject(null);
        localStorage.removeItem('selectedProject');
      }
    } catch (error) {
      console.error('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const selectProject = (project) => {
    setSelectedProject(project);
    localStorage.setItem('selectedProject', project.slug);
  };

  const createProject = async (name) => {
    const response = await axios.post(`${API_URL}/api/projects`, { name }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await fetchProjects();
    return response.data;
  };

  const deleteProject = async (slug) => {
    await axios.delete(`${API_URL}/api/projects/${slug}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    await fetchProjects();
  };

  return (
    <ProjectContext.Provider value={{
      projects, selectedProject, loading,
      selectProject, createProject, deleteProject, fetchProjects
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
};
