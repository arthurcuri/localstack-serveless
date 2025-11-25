const { putItem } = require('../utils/dynamodb');
const { publishMessage } = require('../utils/sns');
const { v4: uuidv4 } = require('uuid');

/**
 * Lambda Handler: Create Record API
 * 
 * Endpoint REST para criar registros diretamente no DynamoDB
 * via requisição HTTP POST
 * 
 * Endpoint: POST /records
 * Body: JSON com dados do registro
 * 
 * @param {Object} event - Evento API Gateway
 * @param {Object} context - Contexto da execução Lambda
 * @returns {Promise<Object>} Resposta HTTP
 */
exports.handler = async (event, context) => {
  console.log('🌐 Lambda API Handler iniciada');
  console.log('📋 Evento recebido:', JSON.stringify(event, null, 2));

  // Headers CORS para permitir requisições cross-origin
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Tratar preflight request (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    // 1. Validar método HTTP
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
          error: 'Method Not Allowed',
          message: 'Apenas POST é permitido'
        })
      };
    }

    // 2. Parsear body da requisição
    let body;
    try {
      body = typeof event.body === 'string' 
        ? JSON.parse(event.body) 
        : event.body;
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid JSON',
          message: 'Body da requisição não é um JSON válido'
        })
      };
    }

    // 3. Validar campos obrigatórios
    if (!body.nome) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation Error',
          message: 'Campo "nome" é obrigatório'
        })
      };
    }

    // 4. Criar registro enriquecido
    const itemId = body.id || uuidv4();
    const timestamp = Date.now();

    const item = {
      id: itemId,
      timestamp: timestamp,
      nome: body.nome,
      categoria: body.categoria || 'API',
      preco: parseFloat(body.preco) || 0,
      estoque: parseInt(body.estoque) || 0,
      source: 'API',
      created_at: new Date().toISOString(),
      created_by: event.requestContext?.identity?.sourceIp || 'unknown',
      request_id: context.requestId
    };

    console.log('📝 Criando registro:', JSON.stringify(item));

    // 5. Salvar no DynamoDB
    await putItem(item);

    // 6. Publicar notificação SNS
    const topicArn = process.env.TOPIC_ARN;
    if (topicArn) {
      await publishMessage(
        topicArn,
        {
          event_type: 'RECORD_CREATED_VIA_API',
          record_id: itemId,
          record_name: body.nome,
          created_at: item.created_at
        },
        'New Record Created via API',
        {
          event_type: 'api_creation',
          record_id: itemId
        }
      );
    }

    // 7. Retornar resposta de sucesso
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Registro criado com sucesso',
        id: itemId,
        timestamp: timestamp,
        data: item
      })
    };

  } catch (error) {
    console.error('❌ Erro ao criar registro:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};