import { supabase } from '@/integrations/supabase/client';
import type { DonoProposta } from '@/types';

export const ProfileService = {
  /**
   * Obtém o perfil (Configurações do Dono) do Supabase para o utilizador atual
   */
  async getProfile(): Promise<DonoProposta | null> {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) return null;

    const userId = userData.user.id;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!data) return null;

    let logotipoUrl = data.logotipo_url || '';

    // Se tivermos um path de logotipo, gerar signed URL
    // (bucket 'logos' é privado, getPublicUrl retornaria 403)
    if (logotipoUrl && !logotipoUrl.startsWith('http')) {
      const { data: signedData, error: signError } = await supabase.storage
        .from('logos')
        .createSignedUrl(`${userId}/${logotipoUrl}`, 3600);

      if (!signError && signedData) {
        logotipoUrl = signedData.signedUrl;
      } else {
        console.warn('Falha ao gerar signed URL para logo:', signError);
        logotipoUrl = '';
      }
    }

    return {
      nome: data.nome || '',
      cargo: data.cargo || '',
      empresa: data.empresa || '',
      contacto: data.contacto || '',
      nuit: data.nuit || '',
      endereco: data.endereco || '',
      logotipo: logotipoUrl,
      corPrimaria: data.cor_primaria || '#0B5394',
      dadosBancarios: (data.dados_bancarios as any) || { ativo: false, banco: '', numeroConta: '', nib: '' },
      mobileMoney: (data.mobile_money as any) || { mpesa: { ativo: false, numero: '' }, emola: { ativo: false, numero: '' }, mkesh: { ativo: false, numero: '' } },
    };
  },

  /**
   * Faz upload do logotipo para o Storage.
   * Remove o ficheiro anterior (se existir) para evitar orfãos.
   */
  async uploadLogo(file: File): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Não autenticado');

    const userId = userData.user.id;

    // 1. Buscar e apagar logo anterior (se existir)
    const { data: profile } = await supabase
      .from('profiles')
      .select('logotipo_url')
      .eq('id', userId)
      .single();

    if (profile?.logotipo_url && !profile.logotipo_url.startsWith('http')) {
      const oldPath = `${userId}/${profile.logotipo_url}`;
      await supabase.storage
        .from('logos')
        .remove([oldPath]);
      // Ignorar erro — ficheiro pode já não existir
    }

    // 2. Upload do novo ficheiro
    const fileExt = file.name.split('.').pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    return fileName;
  },

  /**
   * Remove o logotipo do Storage e limpa a referência no perfil
   */
  async removeLogo(): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Não autenticado');

    const userId = userData.user.id;

    // 1. Buscar path actual
    const { data: profile } = await supabase
      .from('profiles')
      .select('logotipo_url')
      .eq('id', userId)
      .single();

    if (profile?.logotipo_url && !profile.logotipo_url.startsWith('http')) {
      const filePath = `${userId}/${profile.logotipo_url}`;
      await supabase.storage
        .from('logos')
        .remove([filePath]);
    }

    // 2. Limpar referência no perfil
    const { error } = await supabase
      .from('profiles')
      .update({ logotipo_url: null })
      .eq('id', userId);

    if (error) throw error;
  },

  /**
   * Atualiza as Configurações do Dono no Supabase
   */
  async updateProfile(perfil: DonoProposta, logoPath?: string): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Utilizador não autenticado');

    const updateData: any = {
      nome: perfil.nome,
      cargo: perfil.cargo,
      empresa: perfil.empresa,
      contacto: perfil.contacto,
      nuit: perfil.nuit,
      endereco: perfil.endereco,
      cor_primaria: perfil.corPrimaria,
      dados_bancarios: perfil.dadosBancarios,
      mobile_money: perfil.mobileMoney,
    };

    if (logoPath) {
      updateData.logotipo_url = logoPath;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userData.user.id);

    if (error) throw error;
  }
};
