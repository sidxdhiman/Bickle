import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProfileModal = ({ isOpen, onClose }) => {
  const [profilePic, setProfilePic] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const pic = localStorage.getItem('profilePic');
    setProfilePic(pic);
  }, [isOpen]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background border border-border rounded-lg p-6 shadow-2xl max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Profile</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X /></button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border border-border bg-accent">
            {profilePic ? <img src={profilePic} alt="profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>}
          </div>
          <label className="px-4 py-2 bg-secondary border border-border rounded cursor-pointer">
            Change profile picture
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          <button onClick={handleLogout} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg">Logout</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
