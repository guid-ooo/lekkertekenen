import { useState, useEffect } from "react";

interface Wave {
  id: number;
  offset: number;
  scale: number;
  isSent: boolean;
  username?: string;
  createdAt: number;
}

interface WaveDisplayProps {
  waves: Wave[];
}

// Different hand emoji skin tones
const HAND_EMOJIS = ['👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿', '👋'];

export const WaveDisplay = ({ waves }: WaveDisplayProps) => {
  const [, forceUpdate] = useState({});

  // Force re-render every 100ms to update animation state
  useEffect(() => {
    if (waves.length === 0) return;
    
    const interval = setInterval(() => {
      forceUpdate({});
    }, 100);
    
    return () => clearInterval(interval);
  }, [waves.length]);

  // Group waves by username
  const receivedWaves = waves.filter(w => !w.isSent);
  const sentWaves = waves.filter(w => w.isSent);
  const groupedWaves = receivedWaves.reduce((acc, wave) => {
    const key = wave.username || 'Anonymous';
    if (!acc[key]) acc[key] = [];
    acc[key].push(wave);
    return acc;
  }, {} as Record<string, Wave[]>);

  // Assign a hand emoji to each unique username
  const usernames = Object.keys(groupedWaves);
  const usernameToEmoji = usernames.reduce((acc, username, idx) => {
    acc[username] = HAND_EMOJIS[idx % HAND_EMOJIS.length];
    return acc;
  }, {} as Record<string, string>);

  return (
    <>
      {/* Sent waves (your own) */}
      {sentWaves.map(wave => (
        <div
          key={wave.id}
          className="absolute top-full mt-1 z-[60]"
          style={{ 
            right: '40%',
            marginRight: `${Math.abs(wave.offset)}px`,
          }}
        >
          <span 
            className="wave text-2xl"
            style={{ 
              fontSize: `${wave.scale * 2}rem`
            }}
          >
            👋
          </span>
        </div>
      ))}
      
      {/* Received waves grouped by username */}
      {Object.entries(groupedWaves).map(([username, userWaves], idx) => {
        // Check if any wave is still in its animation period (2.5s)
        const now = Date.now();
        const hasActiveAnimation = userWaves.some(wave => (now - wave.createdAt) < 2500);
        const handEmoji = usernameToEmoji[username];
        
        return (
          <div
            key={username + idx}
            className="absolute top-full mt-1 z-[60] flex flex-col items-center"
            style={{ 
              left: '40%',
              marginLeft: `${20 * idx}px`,
            }}
          >
            <div className="relative mb-1" style={{ height: '2rem' }}>
              {userWaves.map(wave => (
                <div
                  key={wave.id}
                  className="absolute"
                  style={{ 
                    left: '50%',
                    top: '0',
                    transform: 'translateX(-50%)',
                    marginLeft: `${wave.offset}px`,
                  }}
                >
                  <span 
                    className="wave text-2xl"
                    style={{ 
                      fontSize: `${wave.scale * 2}rem`,
                    }}
                  >
                    {handEmoji}
                  </span>
                </div>
              ))}
            </div>
            <span className={`text-xs text-gray-700 font-medium whitespace-nowrap transition-all duration-500 ${!hasActiveAnimation ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}>
              {username}
            </span>
          </div>
        );
      })}
    </>
  );
};

export const createWave = (baseId: number = Date.now(), isSent: boolean = false, username?: string) => ({
  id: baseId + Math.random(),
  offset: Math.random() * 60 - 30,
  scale: 1 - Math.random() * 0.4,
  isSent,
  username,
  createdAt: Date.now()
});
