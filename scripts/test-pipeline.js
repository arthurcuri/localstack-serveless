#!/usr/bin/env node

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

/**
 * Script de Teste Automatizado do Pipeline
 * 
 * Testa todo o fluxo serverless:
 * 1. Upload de CSV para S3
 * 2. Trigger automático da Lambda
 * 3. Verificação de dados no DynamoDB
 * 4. Teste de API REST
 */

// Configuração AWS LocalStack
const awsConfig = {
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  accessKeyId: 'test',
  secretAccessKey: 'test',
  s3ForcePathStyle: true
};

const s3 = new AWS.S3(awsConfig);
const dynamodb = new AWS.DynamoDB.DocumentClient(awsConfig);
const lambda = new AWS.Lambda(awsConfig);

const BUCKET_NAME = 'data-processing-bucket';
const TABLE_NAME = 'ProcessedData';
const TEST_FILE = path.join(__dirname, '../data/input/produtos.csv');

// Cores para output no terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verificar se LocalStack está rodando
 */
async function checkLocalStack() {
  info('Verificando se LocalStack está ativo...');
  try {
    await s3.listBuckets().promise();
    success('LocalStack está ativo e respondendo');
    return true;
  } catch (err) {
    error('LocalStack não está respondendo. Verifique se está rodando com: docker-compose ps');
    return false;
  }
}

/**
 * Verificar se bucket existe
 */
async function checkBucket() {
  info(`Verificando bucket ${BUCKET_NAME}...`);
  try {
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    success(`Bucket ${BUCKET_NAME} existe`);
    return true;
  } catch (err) {
    error(`Bucket ${BUCKET_NAME} não existe. Execute: serverless deploy --stage local`);
    return false;
  }
}

/**
 * Verificar se tabela DynamoDB existe
 */
async function checkTable() {
  info(`Verificando tabela ${TABLE_NAME}...`);
  try {
    const params = {
      TableName: TABLE_NAME,
      Limit: 1
    };
    await dynamodb.scan(params).promise();
    success(`Tabela ${TABLE_NAME} existe e está acessível`);
    return true;
  } catch (err) {
    error(`Tabela ${TABLE_NAME} não está acessível: ${err.message}`);
    return false;
  }
}

/**
 * Upload de arquivo CSV para S3
 */
async function uploadTestFile() {
  info('Fazendo upload do arquivo de teste...');
  
  if (!fs.existsSync(TEST_FILE)) {
    error(`Arquivo de teste não encontrado: ${TEST_FILE}`);
    return false;
  }

  const fileContent = fs.readFileSync(TEST_FILE);
  const params = {
    Bucket: BUCKET_NAME,
    Key: 'input/produtos.csv',
    Body: fileContent,
    ContentType: 'text/csv'
  };

  try {
    await s3.putObject(params).promise();
    success('Arquivo uploaded com sucesso para s3://data-processing-bucket/input/produtos.csv');
    return true;
  } catch (err) {
    error(`Erro no upload: ${err.message}`);
    return false;
  }
}

/**
 * Aguardar Lambda processar (polling)
 */
async function waitForProcessing(maxAttempts = 10, interval = 2000) {
  info('Aguardando Lambda processar dados...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const params = {
        TableName: TABLE_NAME,
        Limit: 1
      };
      
      const result = await dynamodb.scan(params).promise();
      
      if (result.Items && result.Items.length > 0) {
        success(`Dados processados encontrados no DynamoDB!`);
        return true;
      }
      
      warning(`Tentativa ${i + 1}/${maxAttempts}: Aguardando processamento...`);
      await sleep(interval);
    } catch (err) {
      warning(`Erro ao verificar DynamoDB: ${err.message}`);
    }
  }
  
  error('Timeout: Lambda não processou dados no tempo esperado');
  return false;
}

/**
 * Verificar dados no DynamoDB
 */
async function verifyData() {
  info('Verificando dados processados no DynamoDB...');
  
  try {
    const params = {
      TableName: TABLE_NAME,
      Limit: 100
    };
    
    const result = await dynamodb.scan(params).promise();
    const items = result.Items || [];
    
    success(`Total de registros no DynamoDB: ${items.length}`);
    
    if (items.length > 0) {
      info('\nExemplo de registro processado:');
      console.log(JSON.stringify(items[0], null, 2));
      
      // Validar campos esperados
      const requiredFields = ['id', 'timestamp', 'nome', 'preco', 'source_file'];
      const firstItem = items[0];
      const missingFields = requiredFields.filter(field => !(field in firstItem));
      
      if (missingFields.length === 0) {
        success('Todos os campos esperados estão presentes');
      } else {
        warning(`Campos faltando: ${missingFields.join(', ')}`);
      }
      
      return true;
    } else {
      warning('Nenhum registro encontrado no DynamoDB');
      return false;
    }
  } catch (err) {
    error(`Erro ao verificar dados: ${err.message}`);
    return false;
  }
}

/**
 * Testar API REST
 */
async function testApi() {
  info('Testando API REST para criar registro...');
  
  try {
    const params = {
      FunctionName: 'CreateRecordFunction',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        httpMethod: 'POST',
        body: JSON.stringify({
          nome: 'Produto Teste API',
          categoria: 'Teste Automatizado',
          preco: 199.99,
          estoque: 50
        }),
        requestContext: {
          identity: {
            sourceIp: '127.0.0.1'
          }
        }
      })
    };
    
    const result = await lambda.invoke(params).promise();
    const response = JSON.parse(result.Payload);
    
    if (response.statusCode === 201) {
      success('API REST funcionando corretamente');
      const body = JSON.parse(response.body);
      info(`Registro criado com ID: ${body.id}`);
      return true;
    } else {
      error(`API retornou status ${response.statusCode}`);
      console.log(response.body);
      return false;
    }
  } catch (err) {
    error(`Erro ao testar API: ${err.message}`);
    return false;
  }
}

/**
 * Limpar dados de teste
 */
async function cleanup() {
  info('Limpando dados de teste (opcional)...');
  warning('Para limpar completamente, execute: serverless remove --stage local');
}

/**
 * Main
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  log('🧪 TESTE AUTOMATIZADO DO PIPELINE SERVERLESS', colors.magenta);
  console.log('='.repeat(60) + '\n');

  let allPassed = true;

  // Passo 1: Verificar LocalStack
  if (!await checkLocalStack()) {
    error('\n❌ Falha crítica: LocalStack não está disponível');
    process.exit(1);
  }

  // Passo 2: Verificar recursos
  if (!await checkBucket() || !await checkTable()) {
    error('\n❌ Recursos não estão disponíveis. Execute deploy primeiro.');
    process.exit(1);
  }

  // Passo 3: Upload de arquivo
  if (!await uploadTestFile()) {
    allPassed = false;
  }

  // Passo 4: Aguardar processamento
  await sleep(3000); // Aguardar um pouco antes de começar polling
  if (!await waitForProcessing()) {
    allPassed = false;
  }

  // Passo 5: Verificar dados
  if (!await verifyData()) {
    allPassed = false;
  }

  // Passo 6: Testar API
  await sleep(2000);
  if (!await testApi()) {
    allPassed = false;
  }

  // Passo 7: Cleanup
  await cleanup();

  // Resultado final
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!', colors.green);
  } else {
    log('⚠️  ALGUNS TESTES FALHARAM', colors.yellow);
  }
  console.log('='.repeat(60) + '\n');
}

// Executar
main().catch(err => {
  error(`Erro fatal: ${err.message}`);
  console.error(err);
  process.exit(1);
});