import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http_parser/http_parser.dart';

class ApiService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://localhost:3001/api', // Change to your VPS IP in production
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));

  // Register User and Upload KYC
  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String phone,
    required String walletAddress,
    required String walletChain,
    required XFile biFront,
    required XFile biBack,
  }) async {
    try {
      FormData formData = FormData.fromMap({
        'name': name,
        'email': email,
        'phone': phone,
        'walletAddress': walletAddress,
        'walletChain': walletChain,
        'biFront': await MultipartFile.fromFile(
          biFront.path,
          filename: 'bi_front.jpg',
          contentType: MediaType('image', 'jpeg'),
        ),
        'biBack': await MultipartFile.fromFile(
          biBack.path,
          filename: 'bi_back.jpg',
          contentType: MediaType('image', 'jpeg'),
        ),
      });

      final response = await _dio.post('/users/register', data: formData);
      return response.data;
    } on DioException catch (e) {
      return {
        'success': false,
        'message': e.response?.data['error'] ?? 'Erro de conexão com o servidor'
      };
    }
  }

  // Check Profile Status
  Future<Map<String, dynamic>> checkStatus(String email) async {
    try {
      final response = await _dio.get('/users/status/$email');
      return response.data;
    } catch (e) {
      return {'success': false, 'message': 'Usuário não encontrado'};
    }
  }

  // Create Purchase Order
  Future<Map<String, dynamic>> createOrder(String profileId, double amountUsdt) async {
    try {
      final response = await _dio.post('/payments/create-order', data: {
        'profileId': profileId,
        'amountUsdt': amountUsdt,
      });
      return response.data;
    } on DioException catch (e) {
      return {
        'success': false,
        'message': e.response?.data['error'] ?? 'Erro ao processar pedido'
      };
    }
  }

  // TEST: Instant Withdraw
  Future<Map<String, dynamic>> testWithdraw({
    required String address,
    required double amount,
    required String chain,
  }) async {
    try {
      final response = await _dio.post('/payments/instant-withdraw', data: {
        'address': address,
        'amount': amount,
        'chain': chain,
      });
      return response.data;
    } on DioException catch (e) {
      return {
        'success': false,
        'message': e.response?.data['message'] ?? 'Erro no saque de teste'
      };
    }
  }
}
