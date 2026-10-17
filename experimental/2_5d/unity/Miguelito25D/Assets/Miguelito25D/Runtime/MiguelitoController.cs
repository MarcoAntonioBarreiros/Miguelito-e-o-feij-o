// Miguelito na Unity: porte direto do nucleo de src/physics.js.
//
// Nao usa Rigidbody2D nem o motor de fisica da Unity, de proposito: as
// alturas de salto, os alcances e os desafios validados pelo gerador
// procedural (validateChunk, traversal-encounter-validator) estao medidos na
// fisica cinematica do jogo — caixa 32x48, gravidade 1180 px/s2, corrida 245
// px/s. Trocar por PhysX 2D mudaria todos esses numeros. Aqui os valores sao
// os mesmos, em pixels, com y para baixo; so o desenho converte para unidades.
//
// Portado: corrida com aceleracao exponencial, gravidade, queda maxima, coyote
// time, buffer de pulo, pulo duplo, dash, colisao AABB solida e plataformas de
// sentido unico. NAO portado (fica no JS): propulsao, dano, infeccao, carga de
// fosfato, multiplicadores ecologicos.
using System.Collections.Generic;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace Miguelito25D
{
    public class MiguelitoController : MonoBehaviour
    {
        public const float BoxW = 32f, BoxH = 48f;

        public List<PlatformData> platforms = new List<PlatformData>();
        public float minX, maxX = 4200f;
        public float x = 100f, y = 400f, vx, vy;
        public int facing = 1;
        public bool onGround;
        public bool canDoubleJump = true, canDash = true;

        float coyote, jumpBuffer, dashTime, dashCooldown;
        bool airJumpAvailable, jumpHeldLast;

        // animacao (mesmas regras de player-sprite.js)
        public Sprite[] runFrames, idleFrames;
        public float characterHeight = 64f;
        SpriteRenderer body;
        float animPhase;
        Sprite[] lastSheet;
        public System.Action<Vector2> onJump;

        static float Lerp(float a, float b, float t) => a + (b - a) * t;

        bool Key(string name)
        {
#if ENABLE_INPUT_SYSTEM
            var k = Keyboard.current;
            if (k == null) return false;
            switch (name)
            {
                case "left": return k.leftArrowKey.isPressed || k.aKey.isPressed;
                case "right": return k.rightArrowKey.isPressed || k.dKey.isPressed;
                case "jump": return k.spaceKey.isPressed || k.wKey.isPressed || k.upArrowKey.isPressed;
                case "dash": return k.leftShiftKey.isPressed || k.rightShiftKey.isPressed || k.jKey.isPressed;
            }
            return false;
#else
            switch (name)
            {
                case "left": return Input.GetKey(KeyCode.LeftArrow) || Input.GetKey(KeyCode.A);
                case "right": return Input.GetKey(KeyCode.RightArrow) || Input.GetKey(KeyCode.D);
                case "jump": return Input.GetKey(KeyCode.Space) || Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow);
                case "dash": return Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift) || Input.GetKey(KeyCode.J);
            }
            return false;
#endif
        }

        void Awake()
        {
            var child = new GameObject("Corpo (sprite iluminado)");
            child.transform.SetParent(transform, false);
            body = child.AddComponent<SpriteRenderer>();
            body.sortingOrder = 50;
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, .1f);
            Step(dt);
            Draw(dt);
        }

        void Step(float dt)
        {
            dashCooldown = Mathf.Max(0, dashCooldown - dt);
            bool left = Key("left"), right = Key("right"), jump = Key("jump");
            bool jumpPressed = jump && !jumpHeldLast;
            jumpHeldLast = jump;
            jumpBuffer = jumpPressed ? .12f : Mathf.Max(0, jumpBuffer - dt);

            if (onGround) { coyote = .12f; airJumpAvailable = canDoubleJump; }
            else coyote = Mathf.Max(0, coyote - dt);

            if (dashTime > 0)
            {
                dashTime -= dt;
                vx = facing * 660f;
                vy = 0;
            }
            else
            {
                int target = (right ? 1 : 0) - (left ? 1 : 0);
                if (target != 0) facing = target;
                vx = Lerp(vx, target * 245f, 1 - Mathf.Pow(.0008f, dt));
                if (target == 0) vx *= Mathf.Pow(.00002f, dt);
                vy += 1180f * dt;
                vy = Mathf.Min(vy, 720f);
                if (jumpBuffer > 0 && coyote > 0)
                {
                    vy = -465f; jumpBuffer = 0; coyote = 0;
                    onJump?.Invoke(new Vector2(x + 16, y + 48));
                }
                else if (jumpBuffer > 0 && canDoubleJump && airJumpAvailable)
                {
                    vy = -445f; jumpBuffer = 0; airJumpAvailable = false;
                    onJump?.Invoke(new Vector2(x + 16, y + 39));
                }
            }

            if (canDash && Key("dash") && dashCooldown <= 0 && dashTime <= 0)
            {
                dashTime = .16f;
                dashCooldown = .82f;
            }

            float prevY = y;
            x += vx * dt;
            x = Mathf.Clamp(x, minX, maxX - BoxW);
            onGround = false;
            y += vy * dt;
            foreach (var p in platforms)
            {
                if (p.oneWay)
                {
                    float prevFeet = prevY + BoxH, feet = y + BoxH;
                    bool overlapX = x + BoxW > p.x + 3 && x < p.x + p.w - 3;
                    if (overlapX && vy >= 0 && prevFeet <= p.y + 8 && feet >= p.y)
                    {
                        y = p.y - BoxH; vy = 0; onGround = true;
                    }
                    continue;
                }
                bool hit = x < p.x + p.w && x + BoxW > p.x && y < p.y + p.h && y + BoxH > p.y;
                if (!hit) continue;
                if (prevY + BoxH <= p.y + 10 && vy >= 0) { y = p.y - BoxH; vy = 0; onGround = true; }
                else if (prevY >= p.y + p.h - 8 && vy < 0) { y = p.y + p.h; vy = 0; }
                else if (vx > 0) { x = p.x - BoxW; vx = 0; }
                else if (vx < 0) { x = p.x + p.w; vx = 0; }
            }
            // caiu no vazio: volta ao inicio (o jogo usa checkpoint)
            if (y > 2000) { x = 100; y = 300; vx = vy = 0; }
        }

        void Draw(float dt)
        {
            // posicao: centro-pe da caixa, com o mesmo offsetY (+2) da skin
            transform.position = Px.World(x + BoxW / 2f, y + BoxH + 2f, 0f);
            transform.localScale = new Vector3(facing, 1, 1); // escala, nao flipX: a normal acompanha
            Sprite[] sheet = onGround && Mathf.Abs(vx) <= 12 ? idleFrames : runFrames;
            if (sheet == null || sheet.Length == 0) return;
            if (sheet != lastSheet) { animPhase = 0; lastSheet = sheet; }
            float rate = sheet == runFrames ? Mathf.Min(6f, 1.5f + Mathf.Abs(vx) * .016f) : 6f;
            if (!onGround) rate = 0; // no ar segura o quadro (nao ha folha de pulo ainda)
            animPhase += rate * dt;
            body.sprite = sheet[Mathf.FloorToInt(animPhase) % sheet.Length];
            // altura visivel igual a do jogo: characterHeight / contentHeight do quadro
            float contentHeight = sheet == idleFrames ? 224f : 347f;
            float frameH = body.sprite.rect.height;
            float drawHeightPx = characterHeight * (frameH / contentHeight);
            float s = drawHeightPx / frameH;
            body.transform.localScale = new Vector3(s, s, 1);
        }
    }
}
