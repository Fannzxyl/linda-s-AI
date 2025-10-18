// peta kata kunci → ekspresi
export type Expression = "neutral" | "blink" | "wink" | "smile" | "sad";

const POS = [
  "senang","bahagia","hore","nice","mantap","keren","yeay","hehe","haha",
  "makasih","terima kasih","good","great","wow"
];
const NEG = [
  "sedih","down","kecewa","capek","lelah","maaf","aduh","hiks","susah",
  "error","gagal"
];
const TSUN = ["tsun","nyebelin","hmpf","hmmph","hmpf","gereget"];

export function guessExpressionFromText(t: string): Expression {
  const s = (t||"").toLowerCase();
  if (POS.some(w => s.includes(w))) return "smile";
  if (NEG.some(w => s.includes(w))) return "sad";
  if (TSUN.some(w => s.includes(w))) return "wink";
  return "neutral";
}