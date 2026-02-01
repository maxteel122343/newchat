
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Mic, Video, Image as ImageIcon, MessageSquare, DollarSign, Clock, Tag, Camera, StopCircle, RefreshCw, LayoutGrid, Eye, EyeOff, Maximize, Sliders, Phone, LayoutTemplate, Timer, Zap, Settings, Save, Trash2, Edit, PlayCircle, FolderOpen, CalendarClock, Palette, Layers, Repeat, Play, Pause } from 'lucide-react';
import { CardType, MediaCard, CardDefaults } from '../types';
import { supabase } from '../lib/supabase';
import MediaCardItem from './MediaCardItem';

interface CardModalProps {
  onClose: () => void;
  onSubmit: (card: MediaCard) => void;
  userId?: string;
  initialData?: MediaCard | null;
}

const DEFAULT_SETTINGS_KEY = 'linkcard_defaults';

const CARD_COLORS = [
  '#0f172a', // Navy (Default)
  '#1e1b4b', // Indigo
  '#4c0519', // Rose
  '#022c22', // Emerald
  '#451a03', // Amber
  '#172554', // Blue
  '#000000', // Black
];

const CardModal: React.FC<CardModalProps> = ({ onClose, onSubmit, userId, initialData }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'simple' | 'library'>('create');
  const [showSettings, setShowSettings] = useState(false);

  // Form State
  const [type, setType] = useState<CardType>(CardType.IMAGE);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creditCost, setCreditCost] = useState(10);
  const [category, setCategory] = useState('Premium');
  const [group, setGroup] = useState('Geral');
  const [tags, setTags] = useState('');
  const [duration, setDuration] = useState(60);
  const [expiry, setExpiry] = useState(0); 
  const [repeatInterval, setRepeatInterval] = useState(0); 
  
  // Media Action State
  const [mediaAction, setMediaAction] = useState<string | null>(null);
  
  const [isBlur, setIsBlur] = useState(true);
  const [blurLevel, setBlurLevel] = useState(30); 
  const [defaultWidth, setDefaultWidth] = useState(250);
  const [layoutStyle, setLayoutStyle] = useState<'classic' | 'minimal'>('classic');
  const [cardColor, setCardColor] = useState(CARD_COLORS[0]);
  
  // Media State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [defaultThumbnail, setDefaultThumbnail] = useState<string | null>(null);

  // Library State
  const [myCards, setMyCards] = useState<MediaCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const thumbInputRef = useRef<HTMLInputElement>(null);
  const defaultThumbInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const [defaults, setDefaults] = useState<CardDefaults>({
    title: 'Conteúdo Exclusivo',
    description: 'Toque para desbloquear.',
    creditCost: 10,
    duration: 60,
    expirySeconds: 0,
    group: 'Geral',
    tags: 'premium, vip',
    blurLevel: 30,
    layoutStyle: 'classic',
    defaultWidth: 250,
    repeatInterval: 0,
    category: 'Premium',
    cardColor: CARD_COLORS[0]
  });

  useEffect(() => {
    const saved = localStorage.getItem(DEFAULT_SETTINGS_KEY);
    const savedThumb = localStorage.getItem(DEFAULT_SETTINGS_KEY + '_thumb');
    if (saved) {
      setDefaults(JSON.parse(saved));
    }
    if (savedThumb) {
        setDefaultThumbnail(savedThumb);
    }
  }, []);

  useEffect(() => {
      if (initialData) {
        handleEditCard(initialData);
      }
  }, [initialData]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      clearInterval(recordingTimerRef.current);
    };
  }, [stream]);

  useEffect(() => {
    if (activeTab === 'library' && userId) {
      fetchMyCards();
    }
  }, [activeTab, userId]);

  const fetchMyCards = async () => {
    setLoadingCards(true);
    const { data } = await supabase
      .from('cards')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });
    
    if (data) {
      setMyCards(data.map(c => ({
        id: c.id,
        type: c.type as CardType,
        title: c.title,
        description: c.description,
        thumbnail: c.thumbnail,
        creditCost: c.credit_cost,
        mediaUrl: c.media_url,
        category: c.category,
        tags: c.tags || [],
        duration: c.duration,
        isBlur: c.is_blur,
        blurLevel: c.blur_level,
        createdAt: new Date(c.created_at).getTime(),
        defaultWidth: c.default_width,
        mediaType: 'none',
        expirySeconds: 0,
        saveToGallery: true,
        group: c.group,
        repeatInterval: c.repeat_interval || 0,
        cardColor: c.card_color || CARD_COLORS[0]
      })));
    }
    setLoadingCards(false);
  };

  const handleSaveDefaults = () => {
    localStorage.setItem(DEFAULT_SETTINGS_KEY, JSON.stringify(defaults));
    if (defaultThumbnail) {
        localStorage.setItem(DEFAULT_SETTINGS_KEY + '_thumb', defaultThumbnail);
    }
    setShowSettings(false);
    alert('Padrões salvos!');
  };

  const handleStartCapture = async (mode: 'video' | 'audio' | 'photo') => {
    try {
      setCapturedMedia(null);
      const constraints: MediaStreamConstraints = {
        video: mode === 'video' || mode === 'photo',
        audio: mode !== 'photo'
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      
      setTimeout(() => {
          if (videoRef.current && (mode === 'video' || mode === 'photo')) {
            videoRef.current.srcObject = newStream;
          }
      }, 100);

      if (mode !== 'photo') {
        const recorder = new MediaRecorder(newStream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mode === 'video' ? 'video/webm' : 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setCapturedMedia(url);
          
          if (mode === 'video' && videoRef.current) {
             const canvas = document.createElement('canvas');
             canvas.width = videoRef.current.videoWidth || 640;
             canvas.height = videoRef.current.videoHeight || 480;
             const ctx = canvas.getContext('2d');
             if (ctx) {
                 ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                 setCustomThumbnail(canvas.toDataURL('image/jpeg', 0.8));
             }
          }
          
          clearInterval(recordingTimerRef.current);
          if (stream) stream.getTracks().forEach(track => track.stop());
          setStream(null);
        };

        recorder.start();
        setIsRecording(true);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
      }
    } catch (err) {
      console.error(err);
      alert("Acesso negado à câmera ou microfone.");
    }
  };

  const handleStopCapture = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
    }
  };

  const handleTakePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          setCapturedMedia(dataUrl);
          setCustomThumbnail(dataUrl);
          handleStopCapture();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) setType(CardType.IMAGE);
      else if (file.type.startsWith('video/')) setType(CardType.VIDEO);
      else if (file.type.startsWith('audio/')) setType(CardType.AUDIO);

      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedMedia(reader.result as string);
        if (activeTab === 'simple') {
          handleSubmitSimple(reader.result as string, file.type);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomThumbnail(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

   const handleDefaultThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setDefaultThumbnail(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmitSimple = (media: string, mimeType?: string) => {
    let finalType = type;
    if (mimeType) {
        if (mimeType.startsWith('image/')) finalType = CardType.IMAGE;
        else if (mimeType.startsWith('video/')) finalType = CardType.VIDEO;
        else if (mimeType.startsWith('audio/')) finalType = CardType.AUDIO;
    }

    const newCard: MediaCard = {
      id: Math.random().toString(36).substr(2, 9),
      type: finalType,
      title: defaults.title,
      description: defaults.description,
      creditCost: defaults.creditCost,
      category: defaults.category,
      tags: defaults.tags.split(',').map(t => t.trim()),
      duration: defaults.duration,
      expirySeconds: defaults.expirySeconds * 60,
      group: defaults.group,
      repeatInterval: defaults.repeatInterval,
      isBlur: true,
      blurLevel: defaults.blurLevel,
      saveToGallery: true,
      mediaType: 'upload',
      thumbnail: defaultThumbnail || customThumbnail || media, 
      mediaUrl: media,
      createdAt: Date.now(),
      defaultWidth: defaults.defaultWidth,
      layoutStyle: defaults.layoutStyle,
      cardColor: defaults.cardColor
    };
    onSubmit(newCard);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedMedia && type !== CardType.CHAT) {
      alert("Por favor, selecione ou grave uma mídia.");
      return;
    }
    
    let effectiveThumbnail = customThumbnail || defaultThumbnail;
    if (!effectiveThumbnail) {
        if (type === CardType.IMAGE) effectiveThumbnail = capturedMedia;
        else if (type === CardType.VIDEO && capturedMedia) {
             effectiveThumbnail = capturedMedia; 
        } else {
             effectiveThumbnail = `https://picsum.photos/seed/${Math.random()}/800/600`;
        }
    }

    const newCard: MediaCard = {
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      type,
      title: title || `Novo Card ${type}`,
      description,
      creditCost,
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      duration,
      expirySeconds: expiry * 60, 
      group,
      repeatInterval,
      isBlur,
      blurLevel,
      saveToGallery: true,
      mediaType: mediaAction ? 'record' : 'upload',
      thumbnail: effectiveThumbnail,
      mediaUrl: capturedMedia ? capturedMedia : undefined, 
      createdAt: Date.now(),
      defaultWidth: defaultWidth,
      layoutStyle: layoutStyle,
      cardColor: cardColor
    };
    onSubmit(newCard);
  };

  const handleEditCard = (card: MediaCard) => {
    setType(card.type);
    setTitle(card.title);
    setDescription(card.description);
    setCreditCost(card.creditCost);
    setCategory(card.category);
    setGroup(card.group || 'Geral');
    setTags(card.tags.join(', '));
    setDuration(card.duration);
    setExpiry(card.expirySeconds / 60);
    setRepeatInterval(card.repeatInterval || 0);
    setIsBlur(card.isBlur);
    setBlurLevel(card.blurLevel);
    setDefaultWidth(card.defaultWidth || 250);
    setLayoutStyle(card.layoutStyle || 'classic');
    setCardColor(card.cardColor || CARD_COLORS[0]);
    setCapturedMedia(card.mediaUrl || null);
    setCustomThumbnail(card.thumbnail || null);
    setMediaAction('upload');
    
    setActiveTab('create');
  };

  const handleDeleteCard = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este card?')) {
       await supabase.from('cards').delete().eq('id', id);
       fetchMyCards();
    }
  };

  const resetMedia = () => {
    setCapturedMedia(null);
    setMediaAction(null);
    setCustomThumbnail(null);
    handleStopCapture();
  };

  const previewCard: MediaCard = {
    id: 'preview',
    type,
    title: title || 'Título do Card',
    description: description || 'Descrição do card...',
    creditCost,
    category,
    tags: tags.split(','),
    duration,
    expirySeconds: expiry * 60,
    repeatInterval,
    group,
    isBlur,
    blurLevel,
    saveToGallery: true,
    mediaType: 'none',
    createdAt: Date.now(),
    defaultWidth,
    layoutStyle,
    cardColor,
    thumbnail: customThumbnail || defaultThumbnail || capturedMedia || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop',
    mediaUrl: capturedMedia || ''
  };

  const cardTypes = [
    { id: CardType.IMAGE, icon: <ImageIcon size={22} />, label: 'IMAGEM' },
    { id: CardType.AUDIO, icon: <Mic size={22} />, label: 'ÁUDIO' },
    { id: CardType.VIDEO, icon: <Video size={22} />, label: 'VÍDEO' },
    { id: CardType.CHAT, icon: <MessageSquare size={22} />, label: 'CHAT' },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl overflow-y-auto animate-in fade-in duration-300">
      <div className={`bg-[#0f172a] border border-slate-800 rounded-[2.5rem] w-full ${activeTab === 'create' ? 'max-w-6xl' : 'max-w-4xl'} shadow-2xl flex flex-col max-h-[95vh] border-white/5 relative`}>
        
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-2">
             <button onClick={() => setActiveTab('create')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'create' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>
               <LayoutGrid size={14} /> Avançado
             </button>
             <button onClick={() => setActiveTab('simple')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'simple' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>
               <Zap size={14} /> Simplifica
             </button>
             <button onClick={() => setActiveTab('library')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'library' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>
               <FolderOpen size={14} /> Meus Cards
             </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-8">
          {activeTab === 'simple' && (
            <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in zoom-in-95">
               <div className="text-center space-y-2">
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Modo Rápido</h3>
                 <p className="text-slate-400 text-xs">Selecione seu arquivo e o card será criado com seus padrões.</p>
               </div>
               <div className="w-full max-w-sm">
                 <button onClick={() => fileInputRef.current?.click()} className="w-full aspect-square rounded-[3rem] border-2 border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 flex flex-col items-center justify-center gap-4 transition-all group cursor-pointer">
                    <div className="p-6 rounded-full bg-emerald-500 text-white shadow-xl group-hover:scale-110 transition-transform">
                      <Upload size={48} />
                    </div>
                    <span className="text-sm font-black uppercase tracking-widest text-emerald-500 block">Upload Universal</span>
                 </button>
               </div>
               <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-6 py-3 rounded-full bg-slate-800 text-slate-400 text-[10px] font-black uppercase hover:bg-slate-700 transition-all">
                 <Settings size={14} /> Configurar Padrões
               </button>
               <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*,audio/*" />
            </div>
          )}

          {activeTab === 'library' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center"><button onClick={fetchMyCards} className="p-2 bg-slate-800 rounded-full text-white"><RefreshCw size={16}/></button></div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {myCards.map(card => (
                     <div key={card.id} className="p-4 bg-slate-800/40 rounded-2xl flex gap-4 items-center">
                        <div className="w-16 h-16 bg-black rounded-xl overflow-hidden"><img src={card.thumbnail} className="w-full h-full object-cover opacity-60" /></div>
                        <div className="flex-1 min-w-0"><h4 className="text-white text-sm font-bold truncate">{card.title}</h4></div>
                        <button onClick={() => handleDeleteCard(card.id)} className="p-2 bg-red-600/20 text-red-500 rounded-lg"><Trash2 size={16} /></button>
                     </div>
                   ))}
               </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="flex flex-col lg:flex-row gap-8 h-full">
              <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase">Tipo</label><div className="grid grid-cols-4 gap-2">{cardTypes.map(ct => (<button key={ct.id} type="button" onClick={() => setType(ct.id)} className={`p-3 rounded-2xl border ${type === ct.id ? 'bg-blue-600 border-blue-400' : 'bg-slate-800/40 border-slate-700'}`}>{ct.icon}</button>))}</div></div>
                  
                  <div className="grid grid-cols-4 gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="h-16 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center"><Upload size={16} /><span className="text-[8px] uppercase">Upload</span></button>
                      <button type="button" onClick={() => { setMediaAction('audio_rec'); setType(CardType.AUDIO); handleStartCapture('audio'); }} className="h-16 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center"><Mic size={16} /><span className="text-[8px] uppercase">Audio</span></button>
                      <button type="button" onClick={() => { setMediaAction('video_rec'); setType(CardType.VIDEO); handleStartCapture('video'); }} className="h-16 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center"><Video size={16} /><span className="text-[8px] uppercase">Video</span></button>
                      <button type="button" onClick={() => { setMediaAction('photo_cap'); setType(CardType.IMAGE); handleStartCapture('photo'); }} className="h-16 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center"><Camera size={16} /><span className="text-[8px] uppercase">Foto</span></button>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  </div>

                  {mediaAction && (<div className="relative bg-black h-48 rounded-2xl border border-slate-700 overflow-hidden flex items-center justify-center">
                      {stream && <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />}
                      {capturedMedia && !stream && <div className="text-center"><p className="text-xs text-slate-500">Mídia Capturada</p></div>}
                      <div className="absolute bottom-4 flex gap-4">
                          {isRecording ? (<button type="button" onClick={handleStopCapture} className="p-4 bg-red-600 rounded-full"><div className="w-4 h-4 bg-white rounded-sm" /></button>) : stream && (<button type="button" onClick={() => {}} className="px-4 py-2 bg-red-600 rounded-full text-xs font-black uppercase">Gravar</button>)}
                          {stream && mediaAction === 'photo_cap' && (<button type="button" onClick={handleTakePhoto} className="p-4 border-4 border-white rounded-full" />)}
                      </div>
                      <button type="button" onClick={resetMedia} className="absolute top-2 right-2 p-2 bg-black/50 rounded-full"><X size={14}/></button>
                  </div>)}

                  <div className="space-y-4">
                      <input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 text-xs text-white" required />
                      <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-800/40 p-2 rounded-xl border border-slate-700/50"><label className="text-[8px] uppercase text-slate-500 block">Preço</label><input type="number" value={creditCost} onChange={e => setCreditCost(parseInt(e.target.value))} className="w-full bg-transparent text-sm font-black text-emerald-400 outline-none" /></div>
                          <div className="bg-slate-800/40 p-2 rounded-xl border border-slate-700/50"><label className="text-[8px] uppercase text-slate-500 block">Tempo (s)</label><input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-full bg-transparent text-sm font-black text-white outline-none" /></div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-black uppercase text-slate-500"><span>Blur: {blurLevel}%</span></div>
                        <input type="range" min="0" max="100" value={blurLevel} onChange={e => setBlurLevel(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                     </div>
                  </div>

                  <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-blue-500 shadow-xl">
                    {initialData ? 'Salvar Alterações' : 'Publicar Card'}
                  </button>
                </form>
              </div>

              <div className="hidden lg:flex flex-col flex-1 items-center justify-center bg-black/40 rounded-[2rem] border border-white/5 p-8 relative overflow-hidden">
                 <div className="absolute top-4 left-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Live Preview</div>
                 <div className="pointer-events-none transform scale-110">
                    <MediaCardItem card={previewCard} canManage={false} onUnlock={() => false} isHostMode={false} />
                 </div>
              </div>
            </div>
          )}
        </div>
        {showSettings && (<div className="absolute inset-0 bg-[#0f172a] z-50 p-8 flex flex-col"><div className="flex justify-between"><h3 className="text-white font-black">Configuração</h3><button onClick={() => setShowSettings(false)}><X className="text-white" /></button></div></div>)}
      </div>
    </div>
  );
};

export default CardModal;
