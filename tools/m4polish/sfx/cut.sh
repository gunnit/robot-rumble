#!/bin/zsh
# name  start  length  extra-filter   (all sounds: mono, loudness-normalised, short fade-out, MP3 56 kbps 32 kHz)
set -e
cd ${0:a:h}
cut() { local k=$1 ss=$2 len=$3 extra=${4:-anull} src=${5:-$1}
  ffmpeg -v error -y -i raw/$src.mp3 -ss $ss -t $len -ac 1 -af "$extra,afade=t=in:d=0.005,afade=t=out:st=$(python3 -c "print(max(0,$len*0.75))"):d=$(python3 -c "print($len*0.25)"),loudnorm=I=-18:TP=-1.5:LRA=11" -ar 32000 -c:a libmp3lame -b:a 56k cut/$k.mp3; }
cut splash   0.10 2.30
cut bubble   0.05 0.30
cut torpedo  0.05 0.90
cut boom     0.10 1.40
cut robopop  0.00 0.84
cut rescue   0.15 1.40
cut dolphin  0.05 1.50
cut zap      0.05 0.80
cut puff     0.10 1.10 "atempo=2.0"
cut eel      0.10 1.05
cut ink      0.05 0.55
cut hatch    0.05 1.20
cut bossroar 0.05 2.00
cut whoosh   0.05 0.90
cut bossdefeat 0.05 2.45
cut crab     0.05 0.68
# ambience: 11 s seamless loop (the last second crossfaded into the first), quieter target
ffmpeg -v error -y -i raw/ambience.mp3 -filter_complex "[0]aformat=channel_layouts=mono,asplit=3[a][b][c];[a]atrim=0:1,asetpts=PTS-STARTPTS,afade=t=in:d=1[h];[b]atrim=11:12,asetpts=PTS-STARTPTS,afade=t=out:d=1[t];[h][t]amix=inputs=2:normalize=0[x];[c]atrim=1:11,asetpts=PTS-STARTPTS[m];[x][m]concat=n=2:v=0:a=1,loudnorm=I=-26:TP=-3:LRA=11[o]" -map "[o]" -ar 32000 -c:a libmp3lame -b:a 40k cut/ambience.mp3
