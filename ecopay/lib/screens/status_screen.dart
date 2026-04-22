import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/preferences_service.dart';
import '../main.dart'; // To access Dashboard if we move it later

class StatusScreen extends StatefulWidget {
  const StatusScreen({super.key});

  @override
  State<StatusScreen> createState() => _StatusScreenState();
}

class _StatusScreenState extends State<StatusScreen> {
  final ApiService _apiService = ApiService();
  final PreferencesService _prefs = PreferencesService();
  bool _isLoading = false;

  Future<void> _checkStatus() async {
    setState(() => _isLoading = true);
    final email = await _prefs.getUserEmail();
    if (email != null) {
      final res = await _apiService.checkStatus(email);
      if (res['success'] && res['profile']['status'] == 'approved') {
        // In a real app, navigate to Dashboard
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Conta Aprovada!')));
        }
      } else {
        if (mounted) {
           ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ainda em análise...')));
        }
      }
    }
    setState(() => _isLoading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.verified_user_outlined, size: 80, color: Colors.amberAccent),
              const SizedBox(height: 30),
              Text('Conta em Análise', style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 15),
              const Text(
                'Estamos a verificar os seus documentos e a branquear a sua carteira na Bybit. Este processo demora cerca de 24h.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white54, height: 1.5),
              ),
              const SizedBox(height: 60),
              _isLoading 
                ? const CircularProgressIndicator(color: Colors.greenAccent)
                : _buildButton('VERIFICAR AGORA', _checkStatus),
              const SizedBox(height: 20),
              TextButton(
                onPressed: () async {
                  await _prefs.clearAll();
                  if (mounted) Navigator.pushReplacementNamed(context, '/');
                }, 
                child: const Text('REINICIAR REGISTO', style: TextStyle(color: Colors.redAccent))
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildButton(String text, VoidCallback onPressed) {
    return SizedBox(
      width: double.infinity,
      height: 60,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(backgroundColor: Colors.greenAccent, foregroundColor: Colors.black, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w900)),
      ),
    );
  }
}
