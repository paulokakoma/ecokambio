import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:google_fonts/google_fonts.dart';
import 'services/preferences_service.dart';
import 'screens/register_screen.dart';
import 'screens/status_screen.dart';

void main() {
  runApp(const EcoPayApp());
}

class EcoPayApp extends StatelessWidget {
  const EcoPayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EcoPay',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.green,
        useMaterial3: true,
        textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/init': (context) => const Initializer(),
        '/register': (context) => const RegisterScreen(),
        '/status': (context) => const StatusScreen(),
      },
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) Navigator.pushReplacementNamed(context, '/init');
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Center(
        child: AnimatedBuilder(
          animation: _pulseAnimation,
          builder: (context, child) {
            return Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.greenAccent.withOpacity(0.3 * (1 - _controller.value)),
                        blurRadius: 50 * _controller.value,
                        spreadRadius: 20 * _controller.value,
                      ),
                    ],
                  ),
                  child: Transform.scale(
                    scale: _pulseAnimation.value,
                    child: Image.asset('assets/logo.png', width: 200),
                  ),
                ),
                const SizedBox(height: 60),
                const CupertinoActivityIndicator(color: Colors.greenAccent, radius: 15),
              ],
            );
          },
        ),
      ),
    );
  }
}

class Initializer extends StatefulWidget {
  const Initializer({super.key});

  @override
  State<Initializer> createState() => _InitializerState();
}

class _InitializerState extends State<Initializer> {
  final PreferencesService _prefs = PreferencesService();

  @override
  void initState() {
    super.initState();
    _handleStart();
  }

  Future<void> _handleStart() async {
    final isRegistered = await _prefs.isRegistered();
    if (mounted) {
      if (isRegistered) {
        Navigator.pushReplacementNamed(context, '/status');
      } else {
        Navigator.pushReplacementNamed(context, '/register');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(color: Colors.greenAccent),
      ),
    );
  }
}
