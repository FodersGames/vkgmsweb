import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Package } from 'lucide-react';

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
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
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
      <div className="bg-white border border-[#EDEBE9] rounded-sm shadow-sm">
        <div className="px-6 py-4 border-b border-[#EDEBE9] bg-[#FAFAFA]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0078D4] rounded-sm flex items-center justify-center">
              <Package size={16} className="text-white" />
            </div>
            <h3 className="text-lg font-medium text-[#201F1E]">Send Items</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6" data-testid="send-items-form">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#605E5C] mb-2">
                PLAYER UID
              </label>
              <input
                type="text"
                value={formData.uid}
                onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                className="w-full border border-[#EDEBE9] bg-white rounded-sm text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0078D4] focus:border-[#0078D4]"
                placeholder="player_12345"
                required
                data-testid="uid-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#605E5C] mb-2">
                ITEM VARIABLE
              </label>
              <input
                type="text"
                value={formData.variable}
                onChange={(e) => setFormData({ ...formData, variable: e.target.value })}
                className="w-full border border-[#EDEBE9] bg-white rounded-sm text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0078D4] focus:border-[#0078D4]"
                placeholder="wood, workbench, etc."
                required
                data-testid="variable-input"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#605E5C] mb-2">
                AMOUNT (text or number)
              </label>
              <input
                type="text"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full border border-[#EDEBE9] bg-white rounded-sm text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0078D4] focus:border-[#0078D4]"
                placeholder="10, '100 gold', 'legendary', etc."
                required
                data-testid="amount-input"
              />
              <p className="text-xs text-[#605E5C] mt-1">Accepts any text or number value</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0078D4] text-white hover:bg-[#005A9E] rounded-sm px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
              data-testid="send-items-submit"
            >
              {loading ? 'Sending...' : 'Send Items'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};