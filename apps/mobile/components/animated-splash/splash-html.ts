import { Colors, FontFamily, FontSize, FontWeight } from "@/constants/app-config";

export const SPLASH_BG = Colors.brand.splash;

export const SPLASH_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kodchasan:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{ --ink:${Colors.brand.ink}; --bg:${Colors.brand.splash}; }
  *{box-sizing:border-box;} html,body{height:100%;margin:0;}
  body{background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .stage{
    width:min(460px,80vw);
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:32px;
    animation:stageIn 1.1s cubic-bezier(.22,.61,.36,1) both;
  }
  @keyframes stageIn{ from{opacity:0;transform:scale(.98);} to{opacity:1;transform:none;} }
  .logo{ width:100%; height:auto; display:block; }
  svg path{ fill:var(--ink); }

  .wordmark{
    display:flex;
    justify-content:center;
    align-items:baseline;
    gap:10px;
    font-family:'${FontFamily.brand}',sans-serif;
    font-weight:${FontWeight.medium};
    font-size:clamp(40px,11vw,${FontSize.brand}px);
    color:var(--ink);
    line-height:1;
  }

  .rise{ opacity:0; transform:translateY(14px); animation:riseIn .8s cubic-bezier(.22,.61,.36,1) both; }
  @keyframes riseIn{ to{opacity:1;transform:translateY(0);} }
  .bird{ opacity:0; transform:translate(9px,-6px); animation:birdIn .6s cubic-bezier(.22,.61,.36,1) both; }
  @keyframes birdIn{ to{opacity:1;transform:translate(0,0);} }

  .ltr{
    display:inline-block;
    opacity:0;
    transform:translateY(10px);
    animation:letterIn .55s cubic-bezier(.22,.61,.36,1) both;
  }
  @keyframes letterIn{ to{opacity:1;transform:translateY(0);} }

  .reduced-motion .stage,.reduced-motion .rise,.reduced-motion .bird,.reduced-motion .ltr{animation:none!important;}
  .reduced-motion .rise,.reduced-motion .bird,.reduced-motion .ltr{opacity:1!important;transform:none!important;}
</style>
</head>
<body>
  <div class="stage">
    <svg class="logo" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-label="Haven logo">
      <defs><clipPath id="boat"><rect x="150" y="261" width="150" height="70"/></clipPath></defs>

      <g transform="translate(-674.08,-973.04) scale(5.6000)">
        <g class="boat">
          <path class="rise" style="animation-delay:.35s" d="M 212.77 287.17 C212.57,299.81 212.17,304.44 211.25,304.75 C210.28,305.07 210.00,301.21 210.00,287.58 C210.00,277.91 209.76,270.00 209.46,270.00 C208.63,270.00 189.77,279.13 187.34,280.71 L 185.19 282.11 L 188.49 291.80 C191.82,301.59 192.07,303.57 189.61,300.94 C188.31,299.55 182.00,282.93 182.00,280.90 C182.00,280.36 188.61,276.73 196.70,272.84 L 211.40 265.77 L 217.73 268.89 C222.28,271.13 224.19,271.66 224.52,270.76 C224.78,270.06 225.10,260.73 225.24,250.00 L 225.50 230.50 L 239.50 219.26 C247.20,213.07 254.27,208.01 255.22,208.01 C256.16,208.00 258.46,209.34 260.32,210.98 C262.19,212.61 264.00,213.66 264.36,213.31 C264.71,212.96 265.00,209.10 265.00,204.75 C265.00,198.86 265.32,196.94 266.25,197.25 C267.13,197.55 267.53,200.59 267.60,207.46 C267.68,215.46 268.00,217.42 269.35,218.18 C270.26,218.68 274.17,221.83 278.04,225.18 L 285.08 231.25 L 284.79 238.37 C284.42,247.36 282.67,247.32 282.00,238.32 L 281.50 231.61 L 276.00 227.19 C272.98,224.75 269.38,221.80 268.00,220.63 C261.87,215.38 256.24,211.00 255.64,211.00 C254.62,211.00 248.02,215.96 237.57,224.57 L 228.00 232.46 L 228.00 274.03 L 233.52 276.64 C236.55,278.08 239.28,279.65 239.58,280.14 C240.21,281.14 234.32,300.00 232.93,301.43 C230.67,303.78 231.00,300.31 233.88,291.38 C235.61,286.05 236.91,281.58 236.76,281.44 C236.62,281.30 232.23,279.11 227.00,276.55 C221.77,274.00 216.72,271.48 215.76,270.96 C214.81,270.43 213.81,270.00 213.54,270.00 C213.27,270.00 212.92,277.73 212.77,287.17 Z" clip-path="url(#boat)"/>
        </g>
        <path class="rise" style="animation-delay:.55s" d="M 204.00 250.50 C204.00,261.83 203.76,264.00 202.50,264.00 C201.24,264.00 201.00,261.83 201.00,250.50 C201.00,239.17 201.24,237.00 202.50,237.00 C203.76,237.00 204.00,239.17 204.00,250.50 Z"/>
        <path class="rise" style="animation-delay:.9s" d="M 234.25 314.35 C218.89,315.58 203.41,315.87 199.00,315.02 C196.52,314.54 191.91,314.11 188.75,314.07 C185.59,314.03 183.00,313.64 183.00,313.19 C183.00,312.75 196.27,312.39 212.50,312.39 C241.43,312.39 249.63,313.13 234.25,314.35 Z"/>
        <path class="rise" style="animation-delay:1.0s" d="M 222.25 324.36 C214.69,325.61 198.65,324.55 199.22,322.84 C199.71,321.36 226.00,321.15 226.00,322.62 C226.00,323.23 224.31,324.02 222.25,324.36 Z"/>
      </g>

      <g class="birds" transform="translate(-422.00,-507.60) scale(4.0000)">
        <path class="bird" style="animation-delay:1.70s" d="M 190.74 191.48 C188.96,192.56 187.27,193.57 187.00,193.71 C186.73,193.85 185.82,193.53 185.00,193.00 C184.18,192.47 182.46,192.02 181.19,192.02 C179.76,192.01 179.14,191.58 179.57,190.89 C179.97,190.25 181.64,190.01 183.57,190.32 C185.76,190.67 187.27,190.37 188.06,189.43 C189.28,187.96 194.00,187.42 193.99,188.75 C193.99,189.16 192.53,190.39 190.74,191.48 Z"/>
        <path class="bird" style="animation-delay:1.85s" d="M 218.72 199.07 C217.31,201.34 216.83,201.43 215.15,199.75 C214.46,199.06 212.57,198.50 210.95,198.50 C206.46,198.50 207.93,196.51 212.50,196.41 C214.70,196.36 217.77,195.79 219.32,195.16 C220.86,194.52 222.81,194.00 223.65,194.00 C225.97,194.00 224.65,196.46 222.13,196.82 C220.92,197.00 219.38,198.02 218.72,199.07 Z"/>
        <path class="bird" style="animation-delay:2.00s" d="M 178.52 213.94 C177.82,216.15 175.55,216.69 174.44,214.90 C174.07,214.30 172.45,214.00 170.84,214.24 C169.23,214.47 167.69,214.31 167.43,213.88 C166.65,212.63 171.01,210.77 173.32,211.37 C174.48,211.68 176.12,211.30 176.96,210.54 C178.92,208.78 184.00,207.47 184.00,208.73 C184.00,209.25 182.91,210.17 181.59,210.78 C180.26,211.38 178.88,212.81 178.52,213.94 Z"/>
      </g>
    </svg>
    <div class="wordmark" aria-label="Haven">
      <span class="ltr" style="animation-delay:2.25s">H</span>
      <span class="ltr" style="animation-delay:2.40s">a</span>
      <span class="ltr" style="animation-delay:2.55s">v</span>
      <span class="ltr" style="animation-delay:2.70s">e</span>
      <span class="ltr" style="animation-delay:2.85s">n</span>
    </div>
  </div>
</body>
</html>`;

/** Last letter finishes ~3.4s; brief hold before entering the app. */
export const SPLASH_PLAY_MS = 3600;
