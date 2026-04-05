import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Package } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const SendItems = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    uid: '',
    variable: '',
    amount: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API_URL}/api/items/send`,
        {
          uid: formData.uid,
          variable: formData.variable,
          amount: parseInt(formData.amount)
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success(`Sent ${formData.amount}x ${formData.variable} to ${formData.uid}`);
      setFormData({ uid: '', variable: '', amount: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send items');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-neutral-300 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Package size={28} weight="bold" className="text-neutral-950" />
          <h2 className="text-3xl font-bold text-neutral-950" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>
            SEND ITEMS
          </h2>
        </div>

        <form onSubmit={handleSubmit} data-testid="send-items-form">
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2"
                     style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                PLAYER UID
              </label>
              <input
                type="text"
                value={formData.uid}
                onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:border-neutral-950"
                placeholder="player_12345"
                required
                data-testid="uid-input"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2"
                     style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                ITEM VARIABLE
              </label>
              <input
                type="text"
                value={formData.variable}
                onChange={(e) => setFormData({ ...formData, variable: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:border-neutral-950"
                placeholder="wood, workbench, etc."
                required
                data-testid="variable-input"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-2"
                     style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                AMOUNT
              </label>
              <input
                type="number"
                min="1"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 border border-neutral-300 bg-white text-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:border-neutral-950"
                placeholder="10"
                required
                data-testid="amount-input"
                style={{ fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neutral-950 text-white py-3 font-bold uppercase tracking-wider hover:bg-neutral-800 transition-all duration-200 disabled:opacity-50"
              data-testid="send-items-submit"
              style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}
            >
              {loading ? 'SENDING...' : 'SEND ITEMS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};