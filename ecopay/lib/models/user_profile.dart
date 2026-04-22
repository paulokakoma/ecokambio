class UserProfile {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String walletAddress;
  final String walletChain;
  final String status;

  UserProfile({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.walletAddress,
    required this.walletChain,
    required this.status,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      phone: json['phone'] ?? '',
      walletAddress: json['wallet_address'] ?? json['walletAddress'] ?? '',
      walletChain: json['wallet_chain'] ?? json['walletChain'] ?? 'BSC',
      status: json['status'] ?? 'pending_approval',
    );
  }
}
