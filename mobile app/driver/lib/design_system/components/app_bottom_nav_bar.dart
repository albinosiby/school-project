import 'package:flutter/material.dart';
import '../tokens/app_tokens.dart';

class AppBottomNavBar extends StatelessWidget {
  const AppBottomNavBar({
    super.key,
    required this.index,
    required this.assistant,
    required this.onTap,
  });
  final int index;
  final bool assistant;
  final ValueChanged<int> onTap;
  @override
  Widget build(BuildContext context) {
    final labels = assistant
        ? ['Home', 'Students', 'Stops', 'Duties']
        : ['Home', 'Trips', 'Live', 'Profile'];
    final icons = assistant
        ? [
            Icons.home_outlined,
            Icons.people_outline,
            Icons.location_on_outlined,
            Icons.calendar_month_outlined,
          ]
        : [
            Icons.home_outlined,
            Icons.route_outlined,
            Icons.sensors,
            Icons.account_circle_outlined,
          ];
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
        child: Material(
          elevation: 12,
          shadowColor: Colors.black26,
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: List.generate(
                4,
                (i) => Expanded(
                  child: Semantics(
                    selected: i == index,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => onTap(i),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              icons[i],
                              size: 21,
                              color: i == index
                                  ? C.primary
                                  : C.onSurfaceVariant,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              labels[i],
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: i == index
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: i == index
                                    ? C.primary
                                    : C.onSurfaceVariant,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
