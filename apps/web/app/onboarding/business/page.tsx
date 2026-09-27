"use client";

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SemanticIcon } from '@/src/icons/semantic-icon';
import { Alert } from '@/components/feedback/Alert';
import { useLogout } from '@/src/auth/logout-provider';
import { createBusiness } from '@/src/dashboard/business-client';
import styles from './page.module.css';

const BUSINESS_TYPES = [
  'Retail / E-commerce',
  'Restaurant / Hospitality',
  'Beauty / Personal Care',
  'Professional Services',
  'Financial Services',
  'Healthcare',
  'Education',
  'Property',
  'Automotive',
  'Other'
];

export default function BusinessSetupPage() {
  const router = useRouter();
  const { error: logoutError, isPending: isSigningOut, logout } = useLogout();
  const [view, setView] = useState<'form' | 'loading' | 'success'>('form');
  
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [customType, setCustomType] = useState('');
  const [country, setCountry] = useState('South Africa');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [social, setSocial] = useState('');
  
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, logo: 'Logo must be less than 5MB' }));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.logo;
          return newErrors;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) newErrors.name = 'Business name is required.';
    if (!type) newErrors.type = 'Please select a business type.';
    if (type === 'Other' && !customType.trim()) newErrors.customType = 'Please specify your business type.';
    if (!country.trim()) newErrors.country = 'Country is required.';
    if (!city.trim()) newErrors.city = 'City or service area is required.';
    if (!description.trim()) newErrors.description = 'Please provide a short description.';
    
    if (website && !/^https?:\/\/.*/.test(website)) {
      newErrors.website = 'Website must start with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setView('loading');
    const result = await createBusiness(name);
    if (result.ok === true) {
      setView('success');
      return;
    }

    setView('form');
    const message = result.issue === 'CONFLICT'
      ? 'That Business name is already in use. Try a slightly different name.'
      : result.issue === 'INVALID'
        ? 'Enter a valid Business name.'
        : result.issue === 'UNAUTHENTICATED'
          ? 'Your session has expired. Sign in and try again.'
          : result.issue === 'UNAVAILABLE'
            ? 'SlotlyFlow is temporarily unavailable. Please try again shortly.'
            : 'We could not create your Business. Please try again.';
    setErrors((current) => ({ ...current, form: message }));
  };

  const onComplete = () => router.replace('/dashboard');
  const onSignOut = () => { void logout(); };

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-[#F7F9F8] font-['Spline_Sans'] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-20 h-20 mb-8 flex items-center justify-center">
          <img src="/green_icon.png" alt="SlotlyFlow Icon" className="w-10 h-10 object-contain z-10" />
          <div className="absolute inset-0 rounded-full border-[3px] border-[#E1E8E4] border-t-[#003B2D] animate-spin"></div>
        </div>
        <h2 className="text-[24px] font-bold text-[#111816] tracking-tight mb-2">Setting up your Business...</h2>
        <p className="text-[15px] text-[#66736F] font-medium">Creating your SlotlyFlow workspace.</p>
      </div>
    );
  }

  if (view === 'success') {
    return (
      <div className={`min-h-screen bg-[#F7F9F8] font-['Spline_Sans'] flex flex-col items-center justify-center p-6 text-center ${styles.animateFadeIn}`}>
        <div className="w-20 h-20 rounded-full bg-[#B7F34A]/20 flex items-center justify-center mx-auto mb-6">
          <SemanticIcon concept="success" className="w-10 h-10 text-[#003B2D]" />
        </div>
        <h2 className="text-[32px] font-bold text-[#111816] tracking-tight mb-3">Your Business is ready</h2>
        <p className="text-[16px] text-[#66736F] font-medium mb-10">
          Welcome to <strong className="text-[#111816]">{name}</strong> on SlotlyFlow.
        </p>
        
        <button 
          onClick={onComplete}
          className="px-8 py-3.5 rounded-xl bg-[#003B2D] text-white font-bold text-[15px] hover:bg-[#002B21] transition-all shadow-md hover:shadow-lg flex items-center justify-center min-w-[200px] mx-auto"
        >
          Open dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F8] font-['Spline_Sans'] flex flex-col items-center py-12 px-4 sm:px-6">
      
      {/* Header */}
      <div className={`w-full max-w-[600px] text-center mb-10 ${styles.animateFadeInSlideUp4}`}>
        <div className="flex justify-center mb-8">
          <img 
            src="/slotlyflow-logo-transparent.png" 
            alt="SlotlyFlow" 
            className="w-[180px] h-auto object-contain"
          />
        </div>
        <h1 className="text-[32px] font-bold text-[#111816] tracking-tight mb-3">Set up your Business</h1>
        <p className="text-[16px] text-[#66736F] font-medium max-w-md mx-auto">
          Tell us a little about your Business so we can get your SlotlyFlow workspace ready.
        </p>
      </div>

      {/* Main Form */}
      <div className={`w-full max-w-[600px] bg-white rounded-2xl border border-[#E1E8E4] p-6 sm:p-10 shadow-sm ${styles.animateFadeInSlideUp6}`}>
        <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-8">
          
          {/* Business Info Section */}
          <div className="space-y-5">
            <div>
              <label className="block text-[14px] font-medium text-[#111816] mb-1.5">Business Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="e.g. Wansati Brands"
                className={`w-full px-4 py-3 rounded-xl border ${errors.name ? 'border-[#FF7A66]' : 'border-[#E1E8E4]'} bg-white text-[#111816] placeholder-[#66736F]/50 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors`}
              />
              {errors.name && <p className="mt-1.5 text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.name}</p>}
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#111816] mb-1.5">Business Type</label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    if (errors.type) setErrors(prev => ({ ...prev, type: '' }));
                  }}
                  className={`w-full px-4 py-3 pr-10 rounded-xl border ${errors.type ? 'border-[#FF7A66]' : 'border-[#E1E8E4]'} bg-white text-[#111816] appearance-none focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors`}
                >
                  <option value="" disabled>Select a category...</option>
                  {BUSINESS_TYPES.map(bt => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
                <SemanticIcon concept="chevronDown" className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#66736F] pointer-events-none" />
              </div>
              {errors.type && <p className="mt-1.5 text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.type}</p>}
            </div>

            {type === 'Other' && (
              <div className={styles.animateFadeInSlideDown2}>
                <label className="block text-[14px] font-medium text-[#111816] mb-1.5">Specify Business Type</label>
                <input
                  type="text"
                  value={customType}
                  onChange={(e) => {
                    setCustomType(e.target.value);
                    if (errors.customType) setErrors(prev => ({ ...prev, customType: '' }));
                  }}
                  placeholder="e.g. Graphic Design Studio"
                  className={`w-full px-4 py-3 rounded-xl border ${errors.customType ? 'border-[#FF7A66]' : 'border-[#E1E8E4]'} bg-white text-[#111816] placeholder-[#66736F]/50 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors`}
                />
                {errors.customType && <p className="mt-1.5 text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.customType}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-[14px] font-medium text-[#111816] mb-1.5">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    if (errors.country) setErrors(prev => ({ ...prev, country: '' }));
                  }}
                  placeholder="e.g. South Africa"
                  className={`w-full px-4 py-3 rounded-xl border ${errors.country ? 'border-[#FF7A66]' : 'border-[#E1E8E4]'} bg-white text-[#111816] placeholder-[#66736F]/50 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors`}
                />
                {errors.country && <p className="mt-1.5 text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.country}</p>}
              </div>
              
              <div>
                <label className="block text-[14px] font-medium text-[#111816] mb-1.5">City / Service Area</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (errors.city) setErrors(prev => ({ ...prev, city: '' }));
                  }}
                  placeholder="e.g. Johannesburg"
                  className={`w-full px-4 py-3 rounded-xl border ${errors.city ? 'border-[#FF7A66]' : 'border-[#E1E8E4]'} bg-white text-[#111816] placeholder-[#66736F]/50 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors`}
                />
                {errors.city && <p className="mt-1.5 text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.city}</p>}
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-[#111816] mb-1.5">Short Business Description</label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                }}
                placeholder="What does your Business do? e.g. We sell fashion, fragrances and personal care products online."
                rows={3}
                className={`w-full px-4 py-3 rounded-xl border ${errors.description ? 'border-[#FF7A66]' : 'border-[#E1E8E4]'} bg-white text-[#111816] placeholder-[#66736F]/50 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors resize-none`}
              />
              {errors.description && <p className="mt-1.5 text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.description}</p>}
            </div>
          </div>

          <hr className="border-[#E1E8E4]" />

          {/* Logo Section */}
          <div>
            <div className="mb-3">
              <label className="block text-[14px] font-bold text-[#111816] mb-0.5">Business logo <span className="font-normal text-[#66736F] text-[13px] ml-1">(Optional)</span></label>
              <p className="text-[13px] text-[#66736F]">Add your logo so your Business is easy to recognise inside SlotlyFlow.</p>
            </div>
            
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl bg-[#F7F9F8] border border-[#E1E8E4] flex items-center justify-center shrink-0 overflow-hidden relative">
                {logoPreview ? (
                  <img src={logoPreview} alt="Business logo preview" className="w-full h-full object-cover" />
                ) : (
                  <SemanticIcon concept="organization" className="w-8 h-8 text-[#66736F]/40" />
                )}
              </div>
              
              <div className="flex-1">
                <input 
                  type="file" 
                  accept="image/*"
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                />
                
                {logoPreview ? (
                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl border border-[#E1E8E4] bg-white text-[#111816] text-[13px] font-medium hover:bg-[#F7F9F8] transition-colors"
                    >
                      Replace image
                    </button>
                    <button 
                      type="button"
                      onClick={removeLogo}
                      className="text-[13px] font-medium text-[#FF7A66] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E1E8E4] bg-white text-[#111816] text-[13px] font-medium hover:bg-[#F7F9F8] transition-colors"
                  >
                    <SemanticIcon concept="upload" className="w-4 h-4" />
                    Upload image
                  </button>
                )}
              </div>
            </div>
            {errors.logo && <p className="mt-2 text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.logo}</p>}
          </div>

          <hr className="border-[#E1E8E4]" />

          {/* Online Presence */}
          <div>
            <label className="block text-[14px] font-bold text-[#111816] mb-4">Online presence <span className="font-normal text-[#66736F] text-[13px] ml-1">(Optional)</span></label>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#66736F] mb-1.5">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => {
                    setWebsite(e.target.value);
                    if (errors.website) setErrors(prev => ({ ...prev, website: '' }));
                  }}
                  placeholder="https://wansatibrands.co.za"
                  className={`w-full px-4 py-3 rounded-xl border ${errors.website ? 'border-[#FF7A66]' : 'border-[#E1E8E4]'} bg-white text-[#111816] placeholder-[#66736F]/50 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors`}
                />
                {errors.website && <p className="mt-1.5 text-[13px] font-medium text-[#FF7A66] flex items-center gap-1"><SemanticIcon concept="alert" className="w-3.5 h-3.5" />{errors.website}</p>}
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#66736F] mb-1.5">Social profile</label>
                <input
                  type="text"
                  value={social}
                  onChange={(e) => setSocial(e.target.value)}
                  placeholder="Instagram, Facebook or other profile"
                  className="w-full px-4 py-3 rounded-xl border border-[#E1E8E4] bg-white text-[#111816] placeholder-[#66736F]/50 focus:outline-none focus:border-[#003B2D] focus:ring-1 focus:ring-[#003B2D] transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            {errors.form && (
              <Alert kind="error" className="mb-3">
                {errors.form}
              </Alert>
            )}
            <button 
              type="submit"
              className="w-full py-4 rounded-xl bg-[#003B2D] text-white font-bold text-[16px] hover:bg-[#002B21] transition-all shadow-md hover:shadow-lg flex items-center justify-center"
            >
              Create Business
            </button>
          </div>
        </form>
      </div>

      {/* Footer Links */}
      <div className="mt-8 mb-4">
        <button 
          onClick={onSignOut}
          disabled={isSigningOut}
          className="text-[14px] font-medium text-[#66736F] hover:text-[#111816] hover:underline transition-colors"
        >
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
        {logoutError !== undefined && (
          <Alert kind="error" className="mt-2 text-center">
            {logoutError}
          </Alert>
        )}
      </div>
      
    </div>
  );
}
