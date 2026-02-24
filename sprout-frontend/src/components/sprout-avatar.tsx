"use client";

export function SproutAvatar({
  isSpeaking = false,
  isListening = false,
  size = 220,
}: {
  isSpeaking?: boolean;
  isListening?: boolean;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size * 1.3125, // preserve 320:420 aspect ratio
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes sprout-float {
          0%, 100% { transform: translateY(0px) rotateY(-5deg); }
          50% { transform: translateY(-18px) rotateY(5deg); }
        }
        @keyframes sprout-float-speak {
          0%, 100% { transform: translateY(0px) rotateY(-8deg) scale(1.02); }
          25% { transform: translateY(-10px) rotateY(8deg) scale(1.04); }
          50% { transform: translateY(-20px) rotateY(-6deg) scale(1.02); }
          75% { transform: translateY(-8px) rotateY(6deg) scale(1.04); }
        }
        @keyframes sprout-sway-left {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-8deg); }
        }
        @keyframes sprout-sway-right {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(8deg); }
        }
        @keyframes sprout-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes sprout-blush {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        @keyframes sprout-blush-speak {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes sprout-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes sprout-sparkle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-12px) scale(1.3); opacity: 1; }
        }
        @keyframes sprout-shadow {
          0%, 100% { transform: scaleX(1); opacity: 0.7; }
          50% { transform: scaleX(0.85); opacity: 0.4; }
        }
        @keyframes sprout-mouth-speak {
          0%, 100% { d: path("M126 222 Q160 255 194 222"); }
          50% { d: path("M126 222 Q160 268 194 222"); }
        }
        @keyframes sprout-glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.85; }
        }

        .sprout-wrapper {
          animation: sprout-float 3s ease-in-out infinite;
        }
        .sprout-wrapper.speaking {
          animation: sprout-float-speak 0.9s ease-in-out infinite;
        }
        .sprout-leaf-left {
          transform-origin: 50% 90%;
          animation: sprout-sway-left 2.5s ease-in-out infinite;
        }
        .sprout-leaf-right {
          transform-origin: 50% 90%;
          animation: sprout-sway-right 2.5s ease-in-out infinite 0.3s;
        }
        .sprout-eye-left {
          transform-origin: 130px 195px;
          animation: sprout-blink 4s step-end infinite;
        }
        .sprout-eye-right {
          transform-origin: 190px 195px;
          animation: sprout-blink 4s step-end infinite 0.2s;
        }
        .sprout-cheek {
          animation: sprout-blush 3s ease-in-out infinite;
        }
        .sprout-cheek.speaking {
          animation: sprout-blush-speak 0.6s ease-in-out infinite;
        }
        .sprout-star { animation: sprout-twinkle 1.5s ease-in-out infinite; }
        .sprout-star:nth-child(2) { animation-delay: 0.5s; }
        .sprout-star:nth-child(3) { animation-delay: 1s; }
        .sprout-sparkle {
          position: absolute;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #FFA025;
          animation: sprout-sparkle 3s ease-in-out infinite;
          box-shadow: 0 0 8px 3px rgba(255,160,37,0.55);
        }
        .sprout-sparkle:nth-child(1) { top: 20%; left: 5%; animation-delay: 0s; }
        .sprout-sparkle:nth-child(2) { top: 10%; right: 8%; animation-delay: 0.7s; width: 6px; height: 6px; }
        .sprout-sparkle:nth-child(3) { top: 55%; left: 2%; animation-delay: 1.4s; width: 5px; height: 5px; }
        .sprout-sparkle:nth-child(4) { top: 30%; right: 3%; animation-delay: 2s; }
        .sprout-glow {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(52,211,153,0.22) 0%, transparent 70%);
          animation: sprout-glow-pulse 0.8s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>

      {/* Sparkles */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div className="sprout-sparkle" />
        <div className="sprout-sparkle" />
        <div className="sprout-sparkle" />
        <div className="sprout-sparkle" />
      </div>

      {/* Speaking glow ring */}
      {isSpeaking && <div className="sprout-glow" />}

      <div
        className={`sprout-wrapper${isSpeaking ? " speaking" : ""}`}
        style={{ width: "100%", height: "100%", position: "relative" }}
      >
        <svg
          viewBox="0 0 320 420"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Sprout tutor avatar"
          style={{
            width: "100%",
            height: "100%",
            filter:
              "drop-shadow(0 20px 40px rgba(28,72,21,0.4)) drop-shadow(0 8px 16px rgba(0,0,0,0.15))",
          }}
        >
          <title>Sprout tutor avatar</title>
          <defs>
            <radialGradient id="sa-bodyGrad" cx="38%" cy="32%" r="60%">
              <stop offset="0%" stopColor="#7fcb76" />
              <stop offset="35%" stopColor="#2d6e27" />
              <stop offset="100%" stopColor="#1C4815" />
            </radialGradient>
            <linearGradient id="sa-potGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffc46a" />
              <stop offset="50%" stopColor="#FFA025" />
              <stop offset="100%" stopColor="#c47010" />
            </linearGradient>
            <linearGradient id="sa-rimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffd080" />
              <stop offset="100%" stopColor="#d4801a" />
            </linearGradient>
            <linearGradient id="sa-stemGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1C4815" />
              <stop offset="50%" stopColor="#4a9e42" />
              <stop offset="100%" stopColor="#1C4815" />
            </linearGradient>
            <radialGradient id="sa-leafLGrad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#7fcb76" />
              <stop offset="100%" stopColor="#1C4815" />
            </radialGradient>
            <radialGradient id="sa-leafRGrad" cx="70%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#7fcb76" />
              <stop offset="100%" stopColor="#1C4815" />
            </radialGradient>
            <radialGradient id="sa-shineGrad" cx="35%" cy="25%" r="45%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <linearGradient id="sa-capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2a2a2a" />
              <stop offset="100%" stopColor="#0f0f0f" />
            </linearGradient>
            <linearGradient id="sa-soilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5d4037" />
              <stop offset="100%" stopColor="#3e2723" />
            </linearGradient>
            <filter id="sa-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="4"
                dy="8"
                stdDeviation="6"
                floodColor="rgba(0,0,0,0.25)"
              />
            </filter>
            <filter id="sa-leafShadow">
              <feDropShadow
                dx="2"
                dy="3"
                stdDeviation="3"
                floodColor="rgba(0,0,0,0.2)"
              />
            </filter>
          </defs>

          {/* POT */}
          <path
            d="M95 340 L110 385 L210 385 L225 340 Z"
            fill="url(#sa-potGrad)"
            filter="url(#sa-shadow)"
          />
          <path
            d="M100 340 L112 375 L145 365 L120 340 Z"
            fill="rgba(255,255,255,0.13)"
          />
          <rect
            x="88"
            y="330"
            width="144"
            height="18"
            rx="9"
            fill="url(#sa-rimGrad)"
            filter="url(#sa-shadow)"
          />
          <rect
            x="95"
            y="354"
            width="130"
            height="5"
            rx="2.5"
            fill="rgba(28,72,21,0.18)"
          />
          <ellipse cx="160" cy="330" rx="62" ry="10" fill="url(#sa-soilGrad)" />
          <ellipse
            cx="145"
            cy="327"
            rx="20"
            ry="4"
            fill="rgba(255,255,255,0.08)"
          />

          {/* STEM */}
          <rect
            x="153"
            y="240"
            width="14"
            height="100"
            rx="7"
            fill="url(#sa-stemGrad)"
            filter="url(#sa-shadow)"
          />
          <rect
            x="156"
            y="245"
            width="4"
            height="90"
            rx="2"
            fill="rgba(255,255,255,0.28)"
          />

          {/* LEAVES */}
          <g className="sprout-leaf-left" filter="url(#sa-leafShadow)">
            <path
              d="M160 280 C130 250, 80 255, 75 225 C100 210, 150 230, 160 280 Z"
              fill="url(#sa-leafLGrad)"
            />
            <path
              d="M160 278 C140 255, 110 238, 80 228"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>
          <g className="sprout-leaf-right" filter="url(#sa-leafShadow)">
            <path
              d="M160 270 C190 240, 240 245, 245 215 C220 200, 170 220, 160 270 Z"
              fill="url(#sa-leafRGrad)"
            />
            <path
              d="M160 268 C180 245, 210 228, 242 218"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* HEAD */}
          <ellipse
            cx="160"
            cy="178"
            rx="95"
            ry="98"
            fill="url(#sa-bodyGrad)"
            filter="url(#sa-shadow)"
          />
          <ellipse
            cx="160"
            cy="178"
            rx="95"
            ry="98"
            fill="url(#sa-shineGrad)"
          />

          {/* GRADUATION CAP */}
          <ellipse cx="160" cy="98" rx="55" ry="10" fill="#222" />
          <rect
            x="105"
            y="82"
            width="110"
            height="18"
            rx="5"
            fill="url(#sa-capGrad)"
          />
          <rect
            x="100"
            y="72"
            width="120"
            height="14"
            rx="3"
            fill="url(#sa-capGrad)"
          />
          <ellipse cx="160" cy="72" rx="60" ry="8" fill="#1a1a1a" />
          <rect
            x="105"
            y="87"
            width="110"
            height="5"
            rx="2"
            fill="#FFA025"
            opacity="0.9"
          />
          <ellipse
            cx="140"
            cy="70"
            rx="25"
            ry="4"
            fill="rgba(255,255,255,0.1)"
          />
          <path
            d="M215 72 Q225 90 220 115"
            stroke="#FFA025"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="220" cy="117" r="5" fill="#FFA025" />
          <line
            x1="215"
            y1="117"
            x2="210"
            y2="132"
            stroke="#FFA025"
            strokeWidth="1.5"
          />
          <line
            x1="220"
            y1="122"
            x2="218"
            y2="136"
            stroke="#FFA025"
            strokeWidth="1.5"
          />
          <line
            x1="225"
            y1="117"
            x2="228"
            y2="131"
            stroke="#FFA025"
            strokeWidth="1.5"
          />

          {/* EYEBROWS */}
          <path
            d="M122 178 Q132 170 144 178"
            stroke="#1C4815"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M176 178 Q188 170 198 178"
            stroke="#1C4815"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* EYES */}
          <g className="sprout-eye-left">
            <ellipse cx="133" cy="196" rx="13" ry="14" fill="white" />
            <ellipse cx="135" cy="197" rx="8" ry="9" fill="#1C4815" />
            <ellipse cx="137" cy="195" rx="4" ry="5" fill="#0a0a0a" />
            <circle cx="139" cy="192" r="3" fill="white" />
            <circle cx="133" cy="199" r="1.5" fill="rgba(255,255,255,0.5)" />
          </g>
          <g className="sprout-eye-right">
            <ellipse cx="187" cy="196" rx="13" ry="14" fill="white" />
            <ellipse cx="189" cy="197" rx="8" ry="9" fill="#1C4815" />
            <ellipse cx="191" cy="195" rx="4" ry="5" fill="#0a0a0a" />
            <circle cx="193" cy="192" r="3" fill="white" />
            <circle cx="187" cy="199" r="1.5" fill="rgba(255,255,255,0.5)" />
          </g>

          {/* CHEEKS */}
          <ellipse
            className={`sprout-cheek${isSpeaking ? " speaking" : ""}`}
            cx="110"
            cy="222"
            rx="22"
            ry="13"
            fill="#FFA025"
            opacity="0.4"
          />
          <ellipse
            className={`sprout-cheek${isSpeaking ? " speaking" : ""}`}
            cx="210"
            cy="222"
            rx="22"
            ry="13"
            fill="#FFA025"
            opacity="0.4"
          />

          {/* MOUTH — wider open when speaking */}
          {isSpeaking ? (
            <>
              <path
                d="M126 222 Q160 268 194 222"
                stroke="#1C4815"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M128 225 Q160 264 192 225 Q160 248 128 225 Z"
                fill="white"
              />
            </>
          ) : (
            <>
              <path
                d="M126 222 Q160 255 194 222"
                stroke="#1C4815"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M128 225 Q160 254 192 225 Q160 240 128 225 Z"
                fill="white"
              />
            </>
          )}
          <ellipse
            cx="160"
            cy="212"
            rx="5"
            ry="3.5"
            fill="rgba(28,72,21,0.3)"
          />

          {/* STARS */}
          <g className="sprout-star" style={{ transformOrigin: "68px 155px" }}>
            <polygon
              points="68,148 70,154 76,154 71,158 73,164 68,160 63,164 65,158 60,154 66,154"
              fill="#FFA025"
              opacity="0.9"
            />
          </g>
          <g className="sprout-star" style={{ transformOrigin: "252px 140px" }}>
            <polygon
              points="252,133 254,139 260,139 255,143 257,149 252,145 247,149 249,143 244,139 250,139"
              fill="#FFA025"
              opacity="0.9"
            />
          </g>
          <g className="sprout-star" style={{ transformOrigin: "80px 310px" }}>
            <polygon
              points="80,305 82,309 86,309 83,312 84,316 80,313 76,316 77,312 74,309 78,309"
              fill="#ffc46a"
              opacity="0.75"
            />
          </g>

          {/* BOOK */}
          <g transform="translate(55, 230) rotate(-15)">
            <rect x="0" y="0" width="36" height="28" rx="3" fill="#1C4815" />
            <rect x="3" y="0" width="4" height="28" fill="#FFA025" />
            <rect
              x="9"
              y="6"
              width="22"
              height="2"
              rx="1"
              fill="rgba(255,255,255,0.45)"
            />
            <rect
              x="9"
              y="11"
              width="18"
              height="2"
              rx="1"
              fill="rgba(255,255,255,0.35)"
            />
            <rect
              x="9"
              y="16"
              width="20"
              height="2"
              rx="1"
              fill="rgba(255,255,255,0.35)"
            />
          </g>

          {/* PENCIL */}
          <g transform="translate(228, 218) rotate(30)">
            <rect x="0" y="0" width="8" height="36" rx="2" fill="#FFA025" />
            <polygon points="0,36 8,36 4,46" fill="#ffc46a" />
            <polygon points="2,42 6,42 4,46" fill="#333" />
            <rect x="0" y="0" width="8" height="6" rx="1" fill="#c0c0c0" />
            <rect x="1" y="0" width="6" height="2" fill="#a0a0a0" />
          </g>

          {/* Listening sound waves */}
          {isListening && (
            <g opacity="0.7">
              <ellipse
                cx="160"
                cy="178"
                rx="105"
                ry="108"
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
                opacity="0.3"
              >
                <animate
                  attributeName="rx"
                  values="105;118;105"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="ry"
                  values="108;121;108"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.3;0;0.3"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </ellipse>
              <ellipse
                cx="160"
                cy="178"
                rx="110"
                ry="113"
                fill="none"
                stroke="#34d399"
                strokeWidth="1.5"
                opacity="0.15"
              >
                <animate
                  attributeName="rx"
                  values="110;128;110"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="ry"
                  values="113;131;113"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.15;0;0.15"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </ellipse>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
