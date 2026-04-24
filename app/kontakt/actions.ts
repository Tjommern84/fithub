'use server';

import { createClient } from '@supabase/supabase-js';
import { sendEmail, isEmailConfigured } from '../../lib/emailClient';
import { contactFormEmail, contactAutoReplyEmail } from '../../lib/emailTemplates';

const SUBJECTS = ['Spørsmål', 'Tilbakemelding', 'Bli listeoppført', 'Annet'] as const;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export type ContactState = { ok: boolean; message: string } | null;

export async function submitContactForm(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const name    = String(formData.get('name') ?? '').trim();
  const email   = String(formData.get('email') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  if (!name || !email || !message) {
    return { ok: false, message: 'Fyll ut alle påkrevde felt.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'Ugyldig e-postadresse.' };
  }
  if (!SUBJECTS.includes(subject as typeof SUBJECTS[number])) {
    return { ok: false, message: 'Ugyldig emne.' };
  }

  const supabase = getSupabase();
  if (supabase) {
    await supabase.from('contact_messages').insert({ name, email, subject, message });
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? 'post@fithub.no';

  if (isEmailConfigured) {
    const tpl = contactFormEmail({ name, email, subject, message });
    await sendEmail({ to: adminEmail, replyTo: email, ...tpl });

    const autoReply = contactAutoReplyEmail({ name });
    await sendEmail({ to: email, ...autoReply });
  }

  return { ok: true, message: 'Takk! Vi svarer innen 1–2 virkedager.' };
}
