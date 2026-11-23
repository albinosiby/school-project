import '../../../src/skeleton_shimmer.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/staff_certificates_cubit.dart';
import '../repositories/staff_certificates_repository.dart';

class StaffCertificatesScreen extends StatelessWidget {
  const StaffCertificatesScreen({super.key, required this.repository});
  final IStaffCertificatesRepository repository;
  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => StaffCertificatesCubit(repository)..load(),
    child: Scaffold(
      appBar: AppBar(title: const Text('My school certificates')),
      body: BlocBuilder<StaffCertificatesCubit, StaffCertificatesState>(
        builder: (context, state) {
          final cubit = context.read<StaffCertificatesCubit>();
          return RefreshIndicator(
            onRefresh: cubit.load,
            child: ListView(
              padding: const EdgeInsets.all(20),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const Text('Official certificates issued to you by the school office.'),
                const SizedBox(height: 16),
                if (state.loading) const SchoolSkeletonList(),
                if (state.error != null)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          Text(state.error!),
                          TextButton(onPressed: cubit.load, child: const Text('Retry')),
                        ],
                      ),
                    ),
                  ),
                if (!state.loading && state.rows.isEmpty && state.error == null)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No certificates issued yet. Contact the school office to request one.'),
                  ),
                for (final row in state.rows)
                  Card(
                    child: ListTile(
                      isThreeLine: true,
                      title: Text(row.title),
                      subtitle: Text('${row.number}\n${row.status}${row.issuedOn.isEmpty ? '' : ' · ${row.issuedOn}'}'),
                      trailing: row.downloadable
                          ? IconButton(
                              tooltip: 'Open certificate PDF',
                              onPressed: state.opening == null ? () => cubit.open(row) : null,
                              icon: state.opening == row.id
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                                  : const Icon(Icons.picture_as_pdf_outlined),
                            )
                          : null,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    ),
  );
}
