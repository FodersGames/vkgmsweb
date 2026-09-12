#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/frontend"

echo "=================================================="
echo "   Lancement du site Vakar Games (Test Local)"
echo "=================================================="
echo ""
echo "Site de test : http://localhost:3001"
echo "API connectée : https://vakargames.vercel.app"
echo ""
echo "Ouverture automatique du navigateur..."
echo "Pour quitter, appuie sur Ctrl + C dans cette fenêtre."
echo "=================================================="
echo ""

PORT=3001 yarn start

