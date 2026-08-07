import React, { useState } from 'react';
import { Sparkles, X, Camera, Volume2, Lightbulb, RefreshCw, MessageSquare, CheckCircle2, AlertTriangle } from 'lucide-react';
import { AICameraAnalysis, LiveCaption } from '../types';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeVideoStream?: MediaStream | null;
  liveCaptions?: LiveCaption[];
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  activeVideoStream,
  liveCaptions = [],
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AICameraAnalysis | null>({
    lightingQuality: 'Optimal',
    framingFeedback: 'Subject nicely centered in the upper third grid.',
    suggestedAction: 'Increase fill light slightly on camera left for balanced skin tones.',
    confidence: 0.92,
    timestamp: Date.now(),
  });

  if (!isOpen) return null;

  // Capture current video frame and submit to Gemini API for inspection
  const analyzeCurrentFrame = async () => {
    setAnalyzing(true);
    try {
      let base64Image = '';

      if (activeVideoStream) {
        const videoTrack = activeVideoStream.getVideoTracks()[0];
        if (videoTrack) {
          const videoElement = document.createElement('video');
          videoElement.srcObject = activeVideoStream;
          await videoElement.play();

          const canvas = document.createElement('canvas');
          canvas.width = videoElement.videoWidth || 640;
          canvas.height = videoElement.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            base64Image = canvas.toDataURL('image/jpeg', 0.8);
          }
        }
      }

      const res = await fetch('/api/ai/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image || 'placeholder' }),
      });

      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error('AI Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 bg-black/30 p-6 text-slate-100 shadow-2xl backdrop-blur-xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors border border-transparent hover:border-white/10"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20 border border-white/10">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Gemini AI Director Advisor
              <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                2.5 Flash
              </span>
            </h3>
            <p className="text-xs text-slate-400">Real-time framing, lighting analysis, and broadcast captions</p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between gap-4 mb-4 bg-black/40 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="text-xs text-slate-300">
            <span className="block font-semibold">Inspect Live Camera Frame</span>
            <span className="text-slate-400 text-[11px]">Analyzes exposure, headroom, backlight, and composition</span>
          </div>
          <button
            onClick={analyzeCurrentFrame}
            disabled={analyzing}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-all shrink-0 active:scale-95"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            <span>{analyzing ? 'Analyzing...' : 'Inspect Frame'}</span>
          </button>
        </div>

        {/* Analysis Result Card */}
        {analysis && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-blue-400" /> Frame Quality Report
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Confidence: {(analysis.confidence * 100).toFixed(0)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-black/30 p-2.5 border border-white/10 backdrop-blur-md">
                <span className="text-slate-400 block text-[10px]">Lighting Quality</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {analysis.lightingQuality}
                </span>
              </div>
              <div className="rounded-xl bg-black/30 p-2.5 border border-white/10 backdrop-blur-md">
                <span className="text-slate-400 block text-[10px]">Framing Status</span>
                <span className="font-semibold text-indigo-300 block mt-0.5 truncate">
                  {analysis.framingFeedback}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-purple-950/30 border border-purple-500/20 p-3 text-xs text-purple-200 flex items-start gap-2 backdrop-blur-md">
              <Lightbulb className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-purple-300 font-semibold mb-0.5">Director Advice:</strong>
                <span>{analysis.suggestedAction}</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Broadcast Subtitles & Captions */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-blue-400" /> Live AI Subtitles Feed
            </span>
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="h-32 overflow-y-auto rounded-xl bg-black/40 p-3 text-xs font-mono border border-white/10 space-y-1.5 backdrop-blur-md">
            {liveCaptions.length > 0 ? (
              liveCaptions.map((cap) => (
                <div key={cap.id} className="text-slate-300">
                  <strong className="text-blue-400">{cap.speaker}:</strong> {cap.text}
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-center pt-8">
                Speech audio input is active. Live subtitles will stream here...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
