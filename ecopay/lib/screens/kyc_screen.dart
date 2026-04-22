import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../services/preferences_service.dart';
import 'status_screen.dart';

class KYCScreen extends StatefulWidget {
  final String name, email, phone, wallet, chain;
  const KYCScreen({
    super.key,
    required this.name,
    required this.email,
    required this.phone,
    required this.wallet,
    required this.chain,
  });

  @override
  State<KYCScreen> createState() => _KYCScreenState();
}

class _KYCScreenState extends State<KYCScreen> {
  final ApiService _apiService = ApiService();
  final PreferencesService _prefs = PreferencesService();
  XFile? _biFront;
  XFile? _biBack;
  bool _isLoading = false;

  Future<void> _pickImage(bool isFront) async {
    final ImagePicker picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.camera, imageQuality: 50);
    if (image != null) {
      setState(() {
        if (isFront) _biFront = image; else _biBack = image;
      });
    }
  }

  Future<void> _handleComplete() async {
    if (_biFront == null || _biBack == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Por favor, capture ambos os lados do BI.')));
      return;
    }

    setState(() => _isLoading = true);
    final result = await _apiService.register(
      name: widget.name,
      email: widget.email,
      phone: widget.phone,
      walletAddress: widget.wallet,
      walletChain: widget.chain,
      biFront: _biFront!,
      biBack: _biBack!,
    );

    if (result['success']) {
      await _prefs.setUserEmail(widget.email);
      if (mounted) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (c) => const StatusScreen()),
          (route) => false,
        );
      }
    } else {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Erro no registo')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Verificação', style: GoogleFonts.outfit(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.greenAccent)),
            const Text('Precisamos de uma foto nítida do seu BI.', style: TextStyle(color: Colors.white54)),
            const SizedBox(height: 40),
            _buildCaptureBox('FRENTE DO BI', _biFront, () => _pickImage(true)),
            const SizedBox(height: 20),
            _buildCaptureBox('VERSO DO BI', _biBack, () => _pickImage(false)),
            const Spacer(),
            _isLoading 
              ? const Center(child: CircularProgressIndicator(color: Colors.greenAccent))
              : _buildButton('FINALIZAR REGISTO', _handleComplete),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildCaptureBox(String label, XFile? file, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 180,
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: file != null ? Colors.greenAccent : Colors.white10),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(file != null ? Icons.check_circle_rounded : Icons.camera_alt_rounded, size: 50, color: file != null ? Colors.greenAccent : Colors.white24),
            const SizedBox(height: 10),
            Text(label, style: TextStyle(color: file != null ? Colors.greenAccent : Colors.white24, fontWeight: FontWeight.bold)),
          ],
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
