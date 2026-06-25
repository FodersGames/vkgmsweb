import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const GameShop = () => {
  const { gameSlug } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/shop?game=${gameSlug}`, { replace: true });
  }, [gameSlug, navigate]);
  return null;
};

export default GameShop;
