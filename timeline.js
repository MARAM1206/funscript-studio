// 🎯 FIX: Algoritmo Matemático Puro (Libre de la regla del 5%)
function getCorrectionSuggestion(act1, act2, hwMax, hwMin, factor) {
    let dt_s = (act2.at - act1.at) / 1000.0;
    if (dt_s <= 0) return null;
    let dp = Math.abs(act2.pos - act1.pos);
    let speed = (dp * factor) / dt_s;

    // Si la velocidad está dentro de los límites seguros, no hace nada
    if (speed <= hwMax && (speed >= hwMin || dp === 0)) return null;

    let isTooFast = speed > hwMax;
    // Margen de seguridad (1 mm/s) para garantizar que la línea vuelva a ser azul
    let safe_speed = isTooFast ? hwMax - 1 : hwMin + 1;
    let target_dp = (safe_speed * dt_s) / factor;

    let dir = act2.pos >= act1.pos ? 1 : -1;
    if (dp === 0) dir = act1.pos > 50 ? -1 : 1;

    // 🚀 ELIMINADA LA REGLA DEL 5%. Ahora busca el 1% exacto más cercano.
    let raw2 = act1.pos + dir * target_dp;
    let exact2 = Math.round(raw2);
    exact2 = Math.max(0, Math.min(100, exact2));

    let new_dp2 = Math.abs(exact2 - act1.pos);
    let new_speed2 = (new_dp2 * factor) / dt_s;
    let valid2 = (new_speed2 <= hwMax) && (new_speed2 >= hwMin || new_dp2 === 0);

    if (valid2 && exact2 !== act2.pos) return { modIdx: 2, newPos: exact2 };

    // Si corregir el segundo punto choca con los límites (0% o 100%), intenta corregir el primer punto
    let raw1 = act2.pos - dir * target_dp;
    let exact1 = Math.round(raw1);
    exact1 = Math.max(0, Math.min(100, exact1));

    let new_dp1 = Math.abs(act2.pos - exact1);
    let new_speed1 = (new_dp1 * factor) / dt_s;
    let valid1 = (new_speed1 <= hwMax) && (new_speed1 >= hwMin || new_dp1 === 0);

    if (valid1 && exact1 !== act1.pos) return { modIdx: 1, newPos: exact1 };

    // Si falla por decimales minúsculos, arroja la mejor aproximación posible
    if (exact2 !== act2.pos) return { modIdx: 2, newPos: exact2 };
    return null;
}
