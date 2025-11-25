#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Script de Setup Inicial do Projeto
 * 
 * Automatiza configuração inicial:
 * 1. Verifica dependências instaladas
 * 2. Inicia LocalStack
 * 3. Faz deploy do Serverless
 * 4. Executa teste básico
 */

function execute(command, options = {}) {
  console.log(`\n🔧 Executando: ${command}`);
  try {
    execSync(command, { 
      stdio: 'inherit',
      ...options 
    });
    console.log('✅ Comando executado com sucesso\n');
    return true;
  } catch (error) {
    console.error(`❌ Erro ao executar comando: ${error.message}\n`);
    return false;
  }
}

function checkFile(filePath) {
  return fs.existsSync(filePath);
}

console.log('🚀 Setup do Projeto Serverless LocalStack\n');
console.log('='.repeat(60) + '\n');

// 1. Verificar se estamos no diretório correto
if (!checkFile('package.json')) {
  console.error('❌ Erro: package.json não encontrado. Execute este script do diretório raiz do projeto.');
  process.exit(1);
}

// 2. Instalar dependências Node.js
console.log('📦 Passo 1: Instalando dependências Node.js...');
if (!execute('npm install')) {
  console.error('❌ Falha ao instalar dependências');
  process.exit(1);
}

// 3. Verificar se Docker está rodando
console.log('🐳 Passo 2: Verificando Docker...');
if (!execute('docker ps', { stdio: 'pipe' })) {
  console.error('❌ Docker não está rodando. Inicie o Docker Desktop e tente novamente.');
  process.exit(1);
}

// 4. Iniciar LocalStack
console.log('🌐 Passo 3: Iniciando LocalStack...');
if (!execute('docker-compose up -d')) {
  console.error('❌ Falha ao iniciar LocalStack');
  process.exit(1);
}

// 5. Aguardar LocalStack ficar pronto
console.log('⏳ Aguardando LocalStack inicializar (30 segundos)...');
setTimeout(() => {}, 30000); // Aguardar sincronicamente
execSync('sleep 30', { stdio: 'inherit' });

// 6. Deploy do Serverless
console.log('☁️  Passo 4: Fazendo deploy do Serverless Framework...');
if (!execute('serverless deploy --stage local --verbose')) {
  console.error('❌ Falha no deploy');
  process.exit(1);
}

// 7. Executar teste básico
console.log('🧪 Passo 5: Executando teste básico...');
if (checkFile('scripts/test-pipeline.js')) {
  execute('node scripts/test-pipeline.js');
}

console.log('\n' + '='.repeat(60));
console.log('✅ Setup concluído com sucesso!');
console.log('='.repeat(60));
console.log('\nPróximos passos:');
console.log('  1. Testar pipeline: node scripts/test-pipeline.js');
console.log('  2. Ver logs: serverless logs -f dataProcessor --stage local -t');
console.log('  3. Ver dados: aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name ProcessedData');
console.log('  4. Remover tudo: serverless remove --stage local\n');