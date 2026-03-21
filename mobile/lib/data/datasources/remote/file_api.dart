import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/constants/api_constants.dart';
import '../../models/message_model.dart';
import 'api_client.dart';

class FileApi {
  final ApiClient _client;
  Dio get _dio => _client.dio;

  FileApi(this._client);

  Future<List<FileAttachment>> uploadFiles(List<File> files, String conversationId) async {
    final formData = FormData();
    formData.fields.add(MapEntry('conversation_id', conversationId));
    for (final file in files) {
      formData.files.add(MapEntry(
        'files',
        await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
      ));
    }
    final response = await _dio.post(
      ApiConstants.fileUpload,
      data: formData,
      options: Options(receiveTimeout: const Duration(minutes: 2)),
    );
    return (response.data as List).map((e) => FileAttachment.fromJson(e)).toList();
  }
}
