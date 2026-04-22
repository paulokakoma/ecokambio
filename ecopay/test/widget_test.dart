import 'package:flutter_test/flutter_test.dart';
import 'package:ecopay/main.dart';

void main() {
  testWidgets('EcoPay smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const EcoPayApp());

    // Verify that EcoPay title is present.
    expect(find.text('EcoPay'), findsOneWidget);
    expect(find.text('CARREGAR'), findsOneWidget);
  });
}
