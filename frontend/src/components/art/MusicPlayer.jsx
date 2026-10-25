import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import Waveform from './Waveform';
import { formatDate, formatDuration, mediaUrl } from '../../utils/art';

const MusicPlayer = ({ track, restColor, playedColor, className }) => {
  const audioRef = useRef(null);
  const frameRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  const stopFrame = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  useEffect(() => {
    setCurrent(0);
    setPlaying(false);
    stopFrame();
    return stopFrame;
  }, [track._id]);

  const tick = () => {
    const audio = audioRef.current;
    if (audio) setCurrent(audio.currentTime);
    frameRef.current = requestAnimationFrame(tick);
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
        stopFrame();
        frameRef.current = requestAnimationFrame(tick);
      } catch (error) {
        setPlaying(false);
      }
    } else {
      audio.pause();
      setPlaying(false);
      stopFrame();
    }
  };

  const seek = (ratio) => {
    const audio = audioRef.current;
    const duration = track.duration || audio?.duration || 0;
    if (!audio || !duration) return;
    audio.currentTime = ratio * duration;
    setCurrent(audio.currentTime);
  };

  const duration = track.duration || 0;

  return (
    <div className={className}>
      <audio
        ref={audioRef}
        src={mediaUrl(track.url)}
        preload="metadata"
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
          stopFrame();
        }}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:scale-105 transition-transform duration-300"
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-4 mb-1">
            <p className="truncate font-medium">{track.title}</p>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatDuration(current)} / {formatDuration(duration)}
            </span>
          </div>
          <Waveform
            peaks={track.peaks}
            progress={duration ? current / duration : 0}
            onSeek={seek}
            height={54}
            restColor={restColor}
            playedColor={playedColor}
          />
        </div>
      </div>

      {(track.description || track.madeAt) && (
        <div className="mt-4 pl-[3.75rem]">
          {track.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{track.description}</p>
          )}
          {track.madeAt && (
            <p className="mt-2 text-xs text-muted-foreground">Created {formatDate(track.madeAt, true)}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;
