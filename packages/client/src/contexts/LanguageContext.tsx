import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'zh';

interface Translations {
  en: Record<string, string>;
  zh: Record<string, string>;
}

const translations: Translations = {
  en: {
    // Common
    title: 'KING OF CLAWS',
    back: 'BACK',
    loading: 'LOADING',
    error: 'ERROR',

    // Lobby
    createRoom: 'CREATE ARENA',
    roomNamePlaceholder: 'Enter arena name...',
    activeArenas: 'ACTIVE ARENAS',
    name: 'NAME',
    status: 'STATUS',
    players: 'PLAYERS',
    id: 'ID',

    // Game Board
    room: 'ROOM',
    gameInfo: 'GAME INFO',
    tick: 'TICK',
    agents: 'AGENTS',
    startGame: 'START GAME',
    agentLog: 'AGENT LOG',
    waiting: 'WAITING',
    playing: 'PLAYING',
    finished: 'FINISHED',

    // Player Page
    credits: 'CREDITS',
    agentStatus: 'AGENT STATUS',
    health: 'HEALTH',
    position: 'POSITION',
    airdrop: 'AIRDROP',
    cost: 'COST',
    cooldown: 'COOLDOWN',
    callAirdrop: 'CALL AIRDROP',
    alive: 'ALIVE',
    dead: 'DEAD',

    // Status
    online: 'ONLINE',
    offline: 'OFFLINE',
    connected: 'CONNECTED',
    disconnected: 'DISCONNECTED',
  },
  zh: {
    // Common
    title: '虾王之王',
    back: '返回',
    loading: '加载中',
    error: '错误',

    // Lobby
    createRoom: '创建房间',
    roomNamePlaceholder: '输入房间名称...',
    activeArenas: '活跃房间',
    name: '名称',
    status: '状态',
    players: '玩家',
    id: '编号',

    // Game Board
    room: '房间',
    gameInfo: '游戏信息',
    tick: '回合',
    agents: '智能体',
    startGame: '开始游戏',
    agentLog: '智能体日志',
    waiting: '等待中',
    playing: '进行中',
    finished: '已结束',

    // Player Page
    credits: '积分',
    agentStatus: '智能体状态',
    health: '生命值',
    position: '位置',
    airdrop: '空投',
    cost: '花费',
    cooldown: '冷却',
    callAirdrop: '呼叫空投',
    alive: '存活',
    dead: '阵亡',

    // Status
    online: '在线',
    offline: '离线',
    connected: '已连接',
    disconnected: '已断开',
  },
};

const LanguageContext = createContext<{
  lang: Language;
  setLang: (lang: Language) => void;
  t: Record<string, string>;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('en');

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
