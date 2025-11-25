const AWS = require('aws-sdk');

/**
 * Helper para operações com DynamoDB
 * 
 * Abstrai a complexidade das operações com DynamoDB,
 * facilitando put, get, query e scan operations
 */

// Configuração para LocalStack
const dynamoDbConfig = {
  endpoint: process.env.AWS_ENDPOINT_URL || 'http://localhost:4566',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
};

const dynamodb = new AWS.DynamoDB.DocumentClient(dynamoDbConfig);
const tableName = process.env.TABLE_NAME || 'ProcessedData';

/**
 * Inserir item no DynamoDB
 * @param {Object} item - Item a ser inserido
 * @returns {Promise<Object>} Resultado da operação
 */
async function putItem(item) {
  const params = {
    TableName: tableName,
    Item: item
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`✅ Item inserido no DynamoDB: ${item.id}`);
    return { success: true, item };
  } catch (error) {
    console.error('❌ Erro ao inserir item no DynamoDB:', error);
    throw error;
  }
}

/**
 * Buscar item por chave primária
 * @param {string} id - Partition key
 * @param {number} timestamp - Sort key
 * @returns {Promise<Object>} Item encontrado
 */
async function getItem(id, timestamp) {
  const params = {
    TableName: tableName,
    Key: { id, timestamp }
  };

  try {
    const result = await dynamodb.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('❌ Erro ao buscar item:', error);
    throw error;
  }
}

/**
 * Query items por partition key
 * @param {string} id - Partition key
 * @returns {Promise<Array>} Lista de items
 */
async function queryByIdAsync(id) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': id
    }
  };

  try {
    const result = await dynamodb.query(params).promise();
    return result.Items;
  } catch (error) {
    console.error('❌ Erro ao fazer query:', error);
    throw error;
  }
}

/**
 * Scan completo da tabela (use com cuidado em produção!)
 * @param {number} limit - Limite de items a retornar
 * @returns {Promise<Array>} Lista de todos os items
 */
async function scanTable(limit = 100) {
  const params = {
    TableName: tableName,
    Limit: limit
  };

  try {
    const result = await dynamodb.scan(params).promise();
    console.log(`📊 Scan retornou ${result.Items.length} items`);
    return result.Items;
  } catch (error) {
    console.error('❌ Erro ao fazer scan:', error);
    throw error;
  }
}

/**
 * Atualizar item existente
 * @param {string} id - Partition key
 * @param {number} timestamp - Sort key
 * @param {Object} updates - Campos a atualizar
 * @returns {Promise<Object>} Item atualizado
 */
async function updateItem(id, timestamp, updates) {
  // Construir expressão de update dinamicamente
  const updateExpressionParts = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.keys(updates).forEach((key, index) => {
    const placeholder = `#attr${index}`;
    const valuePlaceholder = `:val${index}`;
    
    updateExpressionParts.push(`${placeholder} = ${valuePlaceholder}`);
    expressionAttributeNames[placeholder] = key;
    expressionAttributeValues[valuePlaceholder] = updates[key];
  });

  const params = {
    TableName: tableName,
    Key: { id, timestamp },
    UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };

  try {
    const result = await dynamodb.update(params).promise();
    console.log(`✏️ Item atualizado: ${id}`);
    return result.Attributes;
  } catch (error) {
    console.error('❌ Erro ao atualizar item:', error);
    throw error;
  }
}

/**
 * Deletar item
 * @param {string} id - Partition key
 * @param {number} timestamp - Sort key
 * @returns {Promise<Object>} Resultado da operação
 */
async function deleteItem(id, timestamp) {
  const params = {
    TableName: tableName,
    Key: { id, timestamp }
  };

  try {
    await dynamodb.delete(params).promise();
    console.log(`🗑️ Item deletado: ${id}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao deletar item:', error);
    throw error;
  }
}

module.exports = {
  putItem,
  getItem,
  queryByIdAsync,
  scanTable,
  updateItem,
  deleteItem
};