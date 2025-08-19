import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const out = document.getElementById("out");

function print(obj){ out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2); }

async function run(){
  try {
    const { data, error } = await supabase.from("app_meta").select("*").order("id", {ascending:false}).limit(3);
    if (error) return print("Error select: " + error.message);
    print({ ok: true, last3: data });
  } catch (e) {
    print("Fallo inesperado: " + (e?.message || e));
  }
}
run();
