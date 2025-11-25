const AWS = require('aws-sdk');

/**
 * Helper para notificações SNS
 * 
 * Simplifica publicação de mensagens em tópicos SNS
 */

const snsConfig = {
  endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
};

const sns = new AWS.SNS(snsConfig);

/**
 * Publicar mensagem em tópico SNS
 * @param {string} topicArn - ARN do tópico
 * @param {string} message - Mensagem a publicar
 * @param {string} subject - Assunto da mensagem
 * @param {Object} attributes - Atributos adicionais
 * @returns {Promise<Object>} Resultado da publicação
 */
async function publishMessage(topicArn, message, subject = 'Notification', attributes = {}) {
  const params = {
    TopicArn: topicArn,
    Message: typeof message === 'object' ? JSON.stringify(message) : message,
    Subject: subject,
    MessageAttributes: {}
  };

  // Adicionar atributos customizados
  Object.keys(attributes).forEach(key => {
    params.MessageAttributes[key] = {
      DataType: 'String',
      StringValue: String(attributes[key])
    };
  });

  try {
    console.log(`📢 Publicando mensagem SNS: ${subject}`);
    const result = await sns.publish(params).promise();
    console.log(`✅ Mensagem publicada. MessageId: ${result.MessageId}`);
    return result;
  } catch (error) {
    console.error('❌ Erro ao publicar mensagem SNS:', error);
    throw error;
  }
}

/**
 * Criar tópico SNS
 * @param {string} topicName - Nome do tópico
 * @returns {Promise<string>} ARN do tópico criado
 */
async function createTopic(topicName) {
  const params = {
    Name: topicName
  };

  try {
    const result = await sns.createTopic(params).promise();
    console.log(`✅ Tópico criado: ${result.TopicArn}`);
    return result.TopicArn;
  } catch (error) {
    console.error('❌ Erro ao criar tópico:', error);
    throw error;
  }
}

/**
 * Inscrever endpoint em tópico
 * @param {string} topicArn - ARN do tópico
 * @param {string} protocol - Protocolo (email, sms, http, etc)
 * @param {string} endpoint - Endpoint a ser inscrito
 * @returns {Promise<Object>} Resultado da inscrição
 */
async function subscribe(topicArn, protocol, endpoint) {
  const params = {
    TopicArn: topicArn,
    Protocol: protocol,
    Endpoint: endpoint
  };

  try {
    const result = await sns.subscribe(params).promise();
    console.log(`✅ Inscrição criada. SubscriptionArn: ${result.SubscriptionArn}`);
    return result;
  } catch (error) {
    console.error('❌ Erro ao criar inscrição:', error);
    throw error;
  }
}

/**
 * Listar tópicos SNS
 * @returns {Promise<Array>} Lista de tópicos
 */
async function listTopics() {
  try {
    const result = await sns.listTopics().promise();
    return result.Topics;
  } catch (error) {
    console.error('❌ Erro ao listar tópicos:', error);
    throw error;
  }
}

module.exports = {
  publishMessage,
  createTopic,
  subscribe,
  listTopics
};