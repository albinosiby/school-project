import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../constants/assest_path.dart';

/// The school product logo (graduation cap over students and an open book), on a transparent background.
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 48});
  final double size;
  @override
  Widget build(BuildContext context) => Image.asset(AssetPaths.logo, width: size.r, height: size.r, fit: BoxFit.contain, semanticLabel: 'EduAdmin logo');
}
