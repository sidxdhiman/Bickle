import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProfileModal = ({ isOpen, onClose, reference }) => {
  const [profilePic, setProfilePic] = useState(null);
  const navigate = useNavigate();
  const modalRef = useRef(null);

  useEffect(() => {
    const pic = localStorage.getItem('profilePic');
    setProfilePic(pic);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target) &&
        reference?.current &&
        !reference.current.contains(event.target)
      ) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, reference]);

  if (!isOpen) return null;

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      localStorage.setItem('profilePic', data);
      setProfilePic(data);
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('backendToken');
    localStorage.removeItem('authUnlocked');
    localStorage.removeItem('profilePic');
    onClose();
    navigate('/');
    // reload to ensure app shows login
    setTimeout(() => window.location.reload(), 50);
  };

  return (
    <div ref={modalRef} className="absolute right-0 top-full mt-2 z-50 w-64 bg-background border border-border rounded-lg p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Profile</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X /></button>
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full overflow-hidden border border-border bg-accent">
          {profilePic ? (
            <img src={profilePic} alt="profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
          )}
        </div>
        <label className="w-full text-center px-4 py-2 bg-secondary border border-border rounded cursor-pointer">
          Change profile picture
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        <button onClick={handleLogout} className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-lg">Logout</button>
      </div>
    </div>
  );
};

export default ProfileModal;
