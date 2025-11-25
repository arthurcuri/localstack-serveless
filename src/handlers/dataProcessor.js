const { getObject } = require('../utils/s3');
const { putItem } = require('../utils/dynamodb');
const { publishMessage } = require('../utils/sns');
const { v4: uuidv4 } = require('uuid');

/**
 * Lambda Handler: Data Processor
 * 
 * Função principal que processa arquivos CSV do S3:
 * 1. Recebe evento de criação de arquivo no S3
 * 2. Lê e parseia o arquivo CSV
 * 3. Valida e transforma os dados
 * 4. Salva cada registro no DynamoDB
 * 5. Publica notificação SNS ao concluir
 * 
 * @param {Object} event - Evento S3 trigger
 * @param {Object} context - Contexto da execução Lambda
 * @returns {Promise<Object>} Resultado do processamento
 */
exports.handler = async (event, context) => {
  console.log('🚀 Lambda Data Processor iniciada');
  console.log('📋 Evento recebido:', JSON.stringify(event, null, 2));

  try {
    // Extrair informações do evento S3
    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    
    console.log(`📁 Processando arquivo: s3://${bucket}/${key}`);

    // 1. Ler arquivo CSV do S3
    const csvContent = await getObject(bucket, key);
    console.log(`📄 Conteúdo do arquivo lido (${csvContent.length} bytes)`);

    // 2. Parsear CSV manualmente (sem dependência externa de csv-parser)
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    console.log(`📊 Headers encontrados: ${headers.join(', ')}`);
    console.log(`📈 Total de linhas (incluindo header): ${lines.length}`);

    const records = [];
    let processedCount = 0;
    let errorCount = 0;

    // 3. Processar cada linha do CSV
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Pular linhas vazias
      if (!line) continue;

      try {
        const values = line.split(',').map(v => v.trim());
        
        // Criar objeto a partir dos headers e values
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index];
        });

        // Validar registro
        if (!record.id || !record.nome) {
          console.warn(`⚠️ Linha ${i + 1}: Dados incompletos, pulando...`);
          errorCount++;
          continue;
        }

        // 4. Enriquecer dados
        const enrichedRecord = {
          id: String(record.id),
          timestamp: Date.now(),
          nome: record.nome,
          categoria: record.categoria || 'Sem categoria',
          preco: parseFloat(record.preco) || 0,
          estoque: parseInt(record.estoque) || 0,
          source_file: key,
          processed_at: new Date().toISOString(),
          processor_version: '1.0.0'
        };

        // 5. Salvar no DynamoDB
        await putItem(enrichedRecord);
        records.push(enrichedRecord);
        processedCount++;
        
        console.log(`✅ Linha ${i + 1} processada: ${record.nome}`);

      } catch (error) {
        console.error(`❌ Erro ao processar linha ${i + 1}:`, error.message);
        errorCount++;
      }
    }

    // 6. Publicar notificação SNS
    const topicArn = process.env.TOPIC_ARN;
    const notification = {
      event_type: 'DATA_PROCESSING_COMPLETED',
      file: key,
      bucket: bucket,
      records_processed: processedCount,
      records_failed: errorCount,
      total_records: lines.length - 1,
      processed_at: new Date().toISOString(),
      lambda_request_id: context.requestId
    };

    if (topicArn) {
      await publishMessage(
        topicArn,
        notification,
        'Data Processing Completed',
        {
          event_type: 'processing_completed',
          file_name: key,
          records_count: String(processedCount)
        }
      );
    }

    // 7. Retornar resultado
    const result = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Processamento concluído com sucesso',
        file: key,
        records_processed: processedCount,
        records_failed: errorCount,
        total_records: lines.length - 1,
        success_rate: ((processedCount / (lines.length - 1)) * 100).toFixed(2) + '%'
      })
    };

    console.log('✅ Processamento concluído:', result.body);
    return result;

  } catch (error) {
    console.error('❌ Erro fatal no processamento:', error);
    
    // Publicar notificação de erro
    try {
      const topicArn = process.env.TOPIC_ARN;
      if (topicArn) {
        await publishMessage(
          topicArn,
          {
            event_type: 'DATA_PROCESSING_FAILED',
            error: error.message,
            stack: error.stack,
            processed_at: new Date().toISOString()
          },
          'Data Processing Failed'
        );
      }
    } catch (notifyError) {
      console.error('❌ Erro ao enviar notificação de falha:', notifyError);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Erro no processamento',
        error: error.message
      })
    };
  }
};