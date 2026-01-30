// hooks/useMessages.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/components/contexts/BusinessContext';
import { useProfiles } from '@/components/contexts/ProfileContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface Message {
  id: string;
  userId: string;
  locationId: string;
  profileId?: string;
  customerId?: string;
  phoneNumber: string;
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  smsCreditsUsed: number;
  templateId?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

export interface Purchase {
  id: string;
  userId: string;
  locationId: string;
  profileId?: string;
  creditsAmount: number;
  totalCost: number;
  paymentPhoneNumber: string;
  paymentStatus: string;
  pesapalTrackingId?: string;
  pesapalMerchantReference?: string;
  pesapalRedirectUrl?: string;
  paymentMethod?: string;
  paymentCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const formatPhoneNumber = (phone: string) => {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('256')) return '+' + cleaned;
  if (cleaned.startsWith('0')) return '+256' + cleaned.substring(1);
  if (cleaned.length === 9 && cleaned.match(/^[7]\d{8}$/)) return '+256' + cleaned;
  return '+256' + cleaned;
};

export const useMessages = (userId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [liveCredits, setLiveCredits] = useState<number>(0);
  // Remove manual loading state; derive from React Query for messages

  const { currentBusiness } = useBusiness();
  const { currentProfile } = useProfiles();
  const queryClient = useQueryClient();

  // -----------------------------
  // FETCH LIVE CREDITS
  // -----------------------------
  const fetchLiveCredits = async () => {
    if (!currentProfile?.id) return;
    const { data, error } = await supabase
      .from('business_profiles')
      .select('sms_credits')
      .eq('id', currentProfile.id)
      .single();

    if (!error && data) setLiveCredits(data.sms_credits);
  };

  // Templates
  const createTemplate = async (templateData: Omit<MessageTemplate, 'id' | 'userId' | 'locationId' | 'createdAt' | 'updatedAt'>) => {
    if (!userId || !currentBusiness?.id) return null;

    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        user_id: userId,
        location_id: currentBusiness.id,
        name: templateData.name,
        content: templateData.content,
        category: templateData.category,
        variables: templateData.variables,
        is_default: templateData.isDefault
      })
      .select()
      .single();

    if (!error && data) {
      const newTemplate: MessageTemplate = {
        id: data.id,
        userId: data.user_id,
        locationId: data.location_id,
        name: data.name,
        content: data.content,
        category: data.category,
        variables: data.variables,
        isDefault: data.is_default,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      setTemplates(prev => [newTemplate, ...prev]);
      return newTemplate;
    }

    return null;
  };

  const updateTemplate = async (id: string, updates: Partial<MessageTemplate>) => {
    const { error } = await supabase
      .from('message_templates')
      .update({
        name: updates.name,
        content: updates.content,
        category: updates.category,
        variables: updates.variables,
        is_default: updates.isDefault,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (!error) {
      await fetchTemplates();
    }
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', id);

    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== id));
    }
  };

  // -----------------------------
  // FETCH MESSAGES
  // -----------------------------
  const fetchMessages = useCallback(async (): Promise<Message[]> => {
    if (!userId || !currentBusiness?.id) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', currentBusiness.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const formattedMessages = data.map(msg => ({
        id: msg.id,
        userId: msg.user_id,
        locationId: msg.location_id,
        profileId: msg.profile_id,
        customerId: msg.customer_id,
        phoneNumber: msg.phone_number,
        content: msg.content,
        status: msg.status,
        smsCreditsUsed: msg.sms_credits_used,
        templateId: msg.template_id,
        errorMessage: msg.error_message,
        sentAt: msg.sent_at,
        deliveredAt: msg.delivered_at,
        createdAt: msg.created_at,
        updatedAt: msg.updated_at,
        metadata: msg.metadata
      }));
      return formattedMessages;
    }
    return [];
  }, [userId, currentBusiness?.id]);

  // React Query caching for messages
  const messagesQueryKey = ['messages', userId, currentBusiness?.id];
  const { data: queriedMessages, isLoading: messagesLoading, isFetching: messagesFetching } = useQuery({
    queryKey: messagesQueryKey,
    queryFn: fetchMessages,
    enabled: !!userId && !!currentBusiness?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (queriedMessages) {
      setMessages(queriedMessages);
    }
  }, [queriedMessages]);

  // -----------------------------
  // FETCH TEMPLATES
  // -----------------------------
  const fetchTemplates = async () => {
    if (!userId || !currentBusiness?.id) return;
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', currentBusiness.id)
      .order('created_at', { ascending: false });

    if (!error) setTemplates(data || []);
  };

  // -----------------------------
  // FETCH PURCHASES
  // -----------------------------
  const fetchPurchases = async () => {
    if (!userId || !currentBusiness?.id) return;
    const { data, error } = await supabase
      .from('sms_credit_purchases')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', currentBusiness.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) setPurchases(data);
  };

  // -----------------------------
  // SEND SMS EDGE
  // -----------------------------
  const sendSMSViaEdgeFunction = async (messageId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('No active session');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ messageId })
    });

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(JSON.stringify(result));
    return result;
  };

  // -----------------------------
  // CREATE SINGLE MESSAGE
  // -----------------------------
  const createMessage = async (messageData: { phoneNumber: string; content: string; customerId?: string; templateId?: string; metadata?: any }) => {
    if (!userId || !currentBusiness?.id || !currentProfile) return null;

    const formattedPhone = formatPhoneNumber(messageData.phoneNumber);

    let finalContent = messageData.content;
    if (messageData.customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('full_name, phone_number, email')
        .eq('id', messageData.customerId)
        .single();
      if (customer) {
        finalContent = finalContent
          .replace(/\{customer_name\}/gi, customer.full_name || 'Customer')
          .replace(/\{customer_phone\}/gi, customer.phone_number || '')
          .replace(/\{customer_email\}/gi, customer.email || '')
          .replace(/\{first_name\}/gi, customer.full_name?.split(' ')[0] || 'Customer')
          .replace(/\{last_name\}/gi, customer.full_name?.split(' ').slice(1).join(' ') || '');
      }
    }

    const creditsNeeded = Math.ceil(finalContent.length / 160);
    if (currentProfile.sms_credits < creditsNeeded) throw new Error(`Insufficient credits`);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        user_id: userId,
        location_id: currentBusiness.id,
        profile_id: currentProfile.id,
        customer_id: messageData.customerId,
        phone_number: formattedPhone,
        content: finalContent,
        template_id: messageData.templateId,
        sms_credits_used: creditsNeeded,
        status: 'pending',
        metadata: messageData.metadata
      })
      .select()
      .single();

    if (error || !data) throw error;

    // Note: Credits will be automatically deducted by database trigger when message status becomes 'sent'
    // This prevents charging for failed messages
    
    const newMessage: Message = { ...data, userId: data.user_id, locationId: data.location_id };
    
    // Update local state immediately
    setMessages(prev => [newMessage, ...prev]);

    // Update React Query cache immediately
    queryClient.setQueryData(messagesQueryKey, (oldData: Message[] | undefined) => {
      return oldData ? [newMessage, ...oldData] : [newMessage];
    });

    // Send SMS asynchronously - edge function will update status which triggers credit deduction
    sendSMSViaEdgeFunction(data.id).catch((err) => {
      console.error('Failed to send SMS:', err);
      // Message status will remain 'pending', no credits deducted
    });

    return newMessage;
  };

  // -----------------------------
  // CREATE BULK MESSAGES
  // -----------------------------
  const createBulkMessages = async (messageData: { customerIds: string[]; content: string; templateId?: string; metadata?: any }) => {
    if (!userId || !currentBusiness?.id || !currentProfile) return { success: 0, failed: 0, errors: [] as string[] };

    const { data: customers } = await supabase
      .from('customers')
      .select('id, full_name, phone_number, email')
      .in('id', messageData.customerIds);

    let totalCreditsNeeded = 0;
    const messagesToInsert: any[] = [];

    (customers || []).forEach(customer => {
      if (!customer.phone_number) return;
      const content = messageData.content
        .replace(/\{customer_name\}/gi, customer.full_name || 'Customer')
        .replace(/\{customer_phone\}/gi, customer.phone_number || '')
        .replace(/\{customer_email\}/gi, customer.email || '')
        .replace(/\{first_name\}/gi, customer.full_name?.split(' ')[0] || 'Customer')
        .replace(/\{last_name\}/gi, customer.full_name?.split(' ').slice(1).join(' ') || '');
      const credits = Math.ceil(content.length / 160);
      totalCreditsNeeded += credits;
      messagesToInsert.push({
        user_id: userId,
        location_id: currentBusiness.id,
        profile_id: currentProfile.id,
        customer_id: customer.id,
        phone_number: formatPhoneNumber(customer.phone_number),
        content,
        template_id: messageData.templateId,
        sms_credits_used: credits,
        status: 'pending',
        metadata: { ...messageData.metadata, bulk: true }
      });
    });

    if (currentProfile.sms_credits < totalCreditsNeeded) throw new Error(`Insufficient credits`);

    const { data: insertedMessages } = await supabase
      .from('messages')
      .insert(messagesToInsert)
      .select();

    // Note: Credits will be automatically deducted by database trigger as each message status becomes 'sent'
    // This ensures customers are only charged for messages that successfully send
    
    // Send each message asynchronously - edge function will update status which triggers credit deduction
    insertedMessages?.forEach(msg => {
      sendSMSViaEdgeFunction(msg.id).catch((err) => {
        console.error('Failed to send SMS:', msg.id, err);
        // Message status will remain 'pending', no credits deducted
      });
    });
    
    queryClient.invalidateQueries({ queryKey: messagesQueryKey });

    return { success: insertedMessages?.length || 0, failed: messagesToInsert.length - (insertedMessages?.length || 0), errors: [] };
  };

  // Initialize credit purchase via Edge Function
  
  const initiateCreditPurchase = async (creditsAmount: number, phoneNumber: string) => {
    if (!userId || !currentBusiness?.id || !currentProfile) {
      throw new Error('Missing user or business context');
    }

    try {
      console.log('=== Initiating Credit Purchase ===');
      console.log('Credits:', creditsAmount);
      console.log('Phone:', phoneNumber);
      console.log('User ID:', userId);
      console.log('Business ID:', currentBusiness.id);
      console.log('Profile ID:', currentProfile.id);

      const creditCost = Number(import.meta.env.VITE_SMS_CREDIT_COST || 100);
      const totalCost = creditsAmount * creditCost;

      console.log('Credit cost:', creditCost);
      console.log('Total cost:', totalCost);

      // Create purchase record
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('sms_credit_purchases')
        .insert({
          user_id: userId,
          location_id: currentBusiness.id,
          profile_id: currentProfile.id,
          credits_amount: creditsAmount,
          total_cost: totalCost,
          payment_phone_number: phoneNumber,
          payment_status: 'pending'
        })
        .select()
        .single();

      if (purchaseError || !purchaseData) {
        console.error('Purchase error:', purchaseError);
        throw new Error('Failed to create purchase record');
      }

      console.log('Purchase record created:', purchaseData.id);

      // Get the current session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('Session check:');
      console.log('- Session exists:', !!session);
      console.log('- Session error:', sessionError);
      console.log('- Access token exists:', !!session?.access_token);
      console.log('- Token preview:', session?.access_token?.substring(0, 30) + '...');
      
      if (!session || !session.access_token) {
        throw new Error('No active session or access token. Please log in again.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ujgxxcgemmfmfsbngnqo.supabase.co';
      const functionUrl = `${supabaseUrl}/functions/v1/pesapal-payment`;
      
      console.log('Calling function URL:', functionUrl);

      const paymentData = {
        purchaseId: purchaseData.id,
        amount: totalCost,
        phoneNumber: phoneNumber,
        description: `Purchase of ${creditsAmount} SMS credits`
      };

      console.log('Payment data:', paymentData);

      // Initiate PesaPal payment with proper headers
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify(paymentData)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || `Payment initiation failed: ${response.status}`);
      }

      // Update purchase with PesaPal details
      await supabase
        .from('sms_credit_purchases')
        .update({
          pesapal_tracking_id: responseData.order_tracking_id,
          pesapal_merchant_reference: responseData.merchant_reference,
          pesapal_redirect_url: responseData.redirect_url
        })
        .eq('id', purchaseData.id);

      console.log('Purchase updated with PesaPal details');

      await fetchPurchases();

      return {
        purchaseId: purchaseData.id,
        redirectUrl: responseData.redirect_url,
        trackingId: responseData.order_tracking_id
      };
    } catch (error) {
      console.error('=== Credit Purchase Error ===');
      console.error(error);
      throw error;
    }
  };

  // -----------------------------
  // REALTIME SUBSCRIPTIONS
  // -----------------------------
  useEffect(() => {
    if (!userId || !currentBusiness?.id) return;

    const messageChannel = supabase
      .channel('messages_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages', 
        filter: `location_id=eq.${currentBusiness.id}` 
      }, () => {
        queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      })
      .subscribe();

    const templateChannel = supabase
      .channel('templates_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'message_templates', 
        filter: `location_id=eq.${currentBusiness.id}` 
      }, fetchTemplates)
      .subscribe();

    const creditsChannel = supabase
      .channel('credits_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'business_profiles', 
        filter: `id=eq.${currentProfile?.id}` 
      }, fetchLiveCredits)
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(templateChannel);
      supabase.removeChannel(creditsChannel);
    };
  }, [userId, currentBusiness?.id, currentProfile?.id]);

  // -----------------------------
  // INITIAL LOAD
  // -----------------------------
  useEffect(() => {
    if (userId && currentBusiness?.id) {
      // Background load ancillary data; messages handled by React Query
      fetchTemplates();
      fetchPurchases();
      fetchLiveCredits();
    }
  }, [userId, currentBusiness?.id, currentProfile?.id]);

  // Derived loading: only true on initial message fetch with no cached data
  const isLoading = messagesLoading && !queriedMessages;

  const getMessageStats = () => {
    const total = messages.length;
    const sent = messages.filter(m => m.status === 'sent' || m.status === 'delivered').length;
    const failed = messages.filter(m => m.status === 'failed').length;
    const pending = messages.filter(m => m.status === 'pending').length;
    const totalCreditsUsed = messages.reduce((sum, m) => sum + m.smsCreditsUsed, 0);

    return { total, sent, failed, pending, totalCreditsUsed, creditsRemaining: liveCredits };
  };

  return {
    messages,
    templates,
    purchases,
    liveCredits,
    isLoading,
    createMessage,
    createBulkMessages,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getMessageStats,
    initiateCreditPurchase,
    refresh: () => { fetchMessages(); fetchTemplates(); fetchPurchases(); fetchLiveCredits(); }
  };

};
