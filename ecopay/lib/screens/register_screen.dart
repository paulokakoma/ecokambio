import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import 'kyc_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _walletController = TextEditingController();
  String _selectedChain = 'BSC';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(30),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 40),
                Text('Criar Conta', 
                  style: GoogleFonts.outfit(fontSize: 42, fontWeight: FontWeight.w900, color: Colors.greenAccent)
                ),
                const Text('Insira os seus dados para começar.', 
                  style: TextStyle(color: Colors.white54, fontSize: 16)
                ),
                const SizedBox(height: 60),
                
                _buildField('Nome Completo', _nameController, Icons.person_outline),
                _buildField('E-mail', _emailController, Icons.email_outlined, keyboardType: TextInputType.emailAddress),
                _buildField('Telemóvel', _phoneController, Icons.phone_android_outlined, keyboardType: TextInputType.phone),
                _buildField('Carteira USDT (Destino)', _walletController, Icons.account_balance_wallet_outlined),
                
                const SizedBox(height: 10),
                const Text('Rede da Carteira', style: TextStyle(color: Colors.white38, fontSize: 12)),
                const SizedBox(height: 8),
                _buildChainDropdown(),
                
                const SizedBox(height: 60),
                _buildSubmitButton(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(String hint, TextEditingController controller, IconData icon, {TextInputType keyboardType = TextInputType.text}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Colors.white10),
      ),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(color: Colors.white),
        validator: (value) => value!.isEmpty ? 'Obrigatório' : null,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Colors.white24),
          prefixIcon: Icon(icon, color: Colors.greenAccent, size: 20),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
        ),
      ),
    );
  }

  Widget _buildChainDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Colors.white10),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedChain,
          isExpanded: true,
          dropdownColor: const Color(0xFF1A1A1A),
          items: ['BSC', 'TRC20', 'POLYGON'].map((String value) {
            return DropdownMenuItem<String>(value: value, child: Text(value, style: const TextStyle(fontWeight: FontWeight.bold)));
          }).toList(),
          onChanged: (val) => setState(() => _selectedChain = val!),
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 60,
      child: ElevatedButton(
        onPressed: () {
          if (_formKey.currentState!.validate()) {
            Navigator.push(context, MaterialPageRoute(builder: (c) => KYCScreen(
              name: _nameController.text,
              email: _emailController.text,
              phone: _phoneController.text,
              wallet: _walletController.text,
              chain: _selectedChain,
            )));
          }
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.greenAccent,
          foregroundColor: Colors.black,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        ),
        child: const Text('PRÓXIMO: DOCUMENTOS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
      ),
    );
  }
}
