-- Bucket público para mídias de disparo WhatsApp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wpp-media',
  'wpp-media',
  true,
  52428800, -- 50MB
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/mpeg','audio/mp4','audio/ogg','audio/opus','audio/aac',
    'video/mp4','video/3gpp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Política: service_role pode fazer tudo; público pode ler
create policy "wpp_media_service_all" on storage.objects
  for all to service_role using (bucket_id = 'wpp-media') with check (bucket_id = 'wpp-media');

create policy "wpp_media_public_read" on storage.objects
  for select to anon using (bucket_id = 'wpp-media');
