import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import '../config.dart';

class BybitService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: BybitConfig.baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  /// Gera a assinatura HMAC-SHA256 para a API V5 da Bybit
  String _generateSignature(String timestamp, String payload, String recvWindow) {
    // Ordem para POST: timestamp + api_key + recv_window + payload
    final String signatureData = timestamp + BybitConfig.apiKey + recvWindow + payload;
    
    final List<int> key = utf8.encode(BybitConfig.apiSecret);
    final List<int> bytes = utf8.encode(signatureData);

    final Hmac hmac = Hmac(sha256, key);
    final Digest digest = hmac.convert(bytes);

    return digest.toString();
  }

  /// Realiza um saque automático para o endereço informado
  Future<Map<String, dynamic>> createWithdrawal({
    required String address,
    required String amount,
    String? coin,
    String? chain,
  }) async {
    const String endpoint = '/v5/asset/withdraw/create';
    final String timestamp = DateTime.now().millisecondsSinceEpoch.toString();
    const String recvWindow = '5000';

    final Map<String, dynamic> body = {
      'coin': coin ?? BybitConfig.defaultCoin,
      'chain': chain ?? BybitConfig.defaultChain,
      'address': address,
      'amount': amount,
      'forceChain': 1, // 1 para saque on-chain
    };

    final String jsonBody = json.encode(body);
    final String signature = _generateSignature(timestamp, jsonBody, recvWindow);

    try {
      final response = await _dio.post(
        endpoint,
        data: body,
        options: Options(
          headers: {
            'X-BAPI-API-KEY': BybitConfig.apiKey,
            'X-BAPI-SIGN': signature,
            'X-BAPI-SIGN-TYPE': '2',
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'Content-Type': 'application/json',
          },
        ),
      );

      final int retCode = response.data['retCode'] ?? -1;
      final String retMsg = response.data['retMsg'] ?? 'Erro desconhecido';

      if (retCode == 0) {
        return {
          'success': true,
          'message': 'Saque solicitado com sucesso!',
          'data': response.data['result'],
        };
      } else {
        return {
          'success': false,
          'message': 'Bybit Error ($retCode): $retMsg',
        };
      }
    } on DioException catch (e) {
      return {
        'success': false,
        'message': 'Erro de rede: ${e.message}',
      };
    } catch (e) {
      return {
        'success': false,
        'message': 'Erro inesperado: $e',
      };
    }
  }
}
