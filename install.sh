#!/bin/bash

echo "🚀 Instalando setup mínimo: health-service + PostgreSQL + Redis"

# Crear archivo .env si no existe
if [ ! -f .env ]; then
  echo "📝 Creando .env desde env.example"
  cp env.example .env
fi

# Instalar dependencias del health-service
echo "📦 Instalando dependencias de health-service..."
cd microservices/health-service
npm install
cd ../..

echo "✅ Instalación completada"
echo ""
echo "Comandos útiles:"
echo "  npm --prefix microservices/health-service run dev     # Ejecutar health-service en desarrollo"
echo "  docker-compose up                                    # Levantar health-service + PostgreSQL + Redis"
