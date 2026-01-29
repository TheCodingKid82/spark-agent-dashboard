"use client";

import React, { useState, useEffect } from 'react';

export type UserIdentity = 'andrew' | 'cale' | 'arthur' | 'henry';

interface UserOption {
  id: UserIdentity;
  name: string;
  role: string;
  emoji: string;
}

const USERS: UserOption[] = [
  { id: 'andrew', name: 'Andrew', role: 'Co-founder', emoji: '👑' },
  { id: 'cale', name: 'Cale', role: 'Co-founder', emoji: '🚀' },
  { id: 'arthur', name: 'Arthur', role: "Cale's Assistant", emoji: '🤖' },
  { id: 'henry', name: 'Henry', role: 'COO', emoji: '🎯' },
];

const STORAGE_KEY = 'spark-studio-user-identity';

export function getUserIdentity(): UserIdentity | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ['andrew', 'cale', 'arthur', 'henry'].includes(stored)) {
    return stored as UserIdentity;
  }
  return null;
}

export function setUserIdentity(id: UserIdentity): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearUserIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface Props {
  onSelect: (identity: UserIdentity) => void;
}

export default function WhoAreYouModal({ onSelect }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if user already identified
    const existing = getUserIdentity();
    if (!existing) {
      setVisible(true);
    } else {
      onSelect(existing);
    }
  }, [onSelect]);

  const handleSelect = (id: UserIdentity) => {
    setUserIdentity(id);
    setVisible(false);
    onSelect(id);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Welcome to Spark Studio
        </h1>
        <p className="text-zinc-400 text-center mb-8">
          Who are you?
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          {USERS.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user.id)}
              className="flex flex-col items-center p-6 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-indigo-500 rounded-xl transition-all duration-200 group"
            >
              <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">
                {user.emoji}
              </span>
              <span className="text-lg font-semibold text-white">
                {user.name}
              </span>
              <span className="text-sm text-zinc-400">
                {user.role}
              </span>
            </button>
          ))}
        </div>
        
        <p className="text-xs text-zinc-600 text-center mt-6">
          This customizes your dashboard experience
        </p>
      </div>
    </div>
  );
}
