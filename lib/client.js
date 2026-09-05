/**
 * Browser half of the SearXNG search provider — the Web-search settings card
 * in the Web UI (Settings → Plugins → Plugin configuration).
 *
 * This file is the client bundle artifact itself: a classic script that only
 * REGISTERS its lazy-CJS factory with `window.__ModuleLoader__` (the DSH
 * client module system's handoff, see `@deepseek-ai/dsh-client-modules`).
 * Every module body side effect — the CSS injection below included — lives in
 * the factory closure and runs at materialization, not at script execution.
 * The repository ships the artifact as-is (no build step), mirroring the
 * closure-factory format the harness `clientBundle` preset emits.
 *
 * The card keeps the look of the "Web search" card the harness ships for the
 * `web-search-deepseek` namespace (same chrome, same field design) with its
 * texts updated to name the SearXNG provider it actually edits. The
 * configurable tab renders one cell per (entry key × served namespace)
 * WITHOUT deduping its cell list, so any second entry claiming the shipped
 * card's key would render under that key twice — this bundle takes the
 * shipped card's seat instead:
 * - a null-rendering tombstone under the `web-search-deepseek` key at
 *   priority -1 shadows the shipped card (keyed slots render the lowest
 *   priority), so the DeepSeek section shows no card; the extra cell the
 *   duplicate key produces dispatches the tombstone and renders empty, so
 *   the tab still shows ONE web-search card — the SearXNG one;
 * - the card itself under its own `web-search-searxng` key, rendered
 *   whenever the section is available, so a deployment without the DeepSeek
 *   provider gets exactly its SearXNG card.
 * The DeepSeek provider itself stays untouched in the deployment; its section
 * simply has no card anymore (its seam selection is unaffected, and a profile
 * may still disable the `web-search-deepseek` row to drop the provider).
 *
 * Module edges the factory requires, and where each answer comes from:
 * - `react`, `react/jsx-runtime` — platform seed (shell instance).
 * - `@deepseek-ai/dsh-client-ui-primitives` — platform seed (chevron icon).
 * - `@deepseek-ai/dsh-client-store` — platform seed (`createSnapshotStore`).
 * Everything else is inlined here: the bundle requires platform seed words
 * only, so no `dsh.client.external` declaration is needed. Cross-plugin
 * collaboration goes through
 * cordis services (`ctx.settingsScope`, `ctx.slots`, `ctx.locale`,
 * `ctx.remote`) — this bundle owns its own card chrome and staging, as the
 * harness documents for plugins that ship a browser half outside the repo.
 *
 * @module @deepseek-ai/dsh-web-search-searxng/client
 */
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-web-search-searxng",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const react = require("react");
		const reactJsx = require("react/jsx-runtime");
		const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		const dshStore = require("@deepseek-ai/dsh-client-store");
		//#region SearxngCard.module.css (hand-authored, ported from the settings card design)
		const css = ".dshSxng_card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s}.dshSxng_card:hover{border-color:var(--dsw-alias-label-dimmed)}.dshSxng_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}.dshSxng_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}.dshSxng_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}.dshSxng_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}.dshSxng_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}.dshSxng_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}.dshSxng_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}.dshSxng_chevronOpen{transform:rotate(180deg)}.dshSxng_body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}.dshSxng_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.dshSxng_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.dshSxng_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.dshSxng_failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5}.dshSxng_discard,.dshSxng_save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.dshSxng_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.dshSxng_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.dshSxng_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.dshSxng_discard:disabled,.dshSxng_save:disabled{opacity:.4;cursor:default}.dshSxng_discard:focus-visible,.dshSxng_save:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}.dshSxng_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.dshSxng_field+.dshSxng_field{border-top:1px solid var(--dsw-alias-border-l2)}.dshSxng_head{align-items:center;gap:8px;display:flex}.dshSxng_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.dshSxng_badges{align-items:center;gap:8px;display:inline-flex}.dshSxng_badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.dshSxng_badgeMuted{white-space:nowrap;color:var(--dsw-alias-label-tertiary);border-radius:999px;padding:1px 8px;font-size:11px;line-height:17px}.dshSxng_reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5}.dshSxng_reset:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.dshSxng_reset:disabled{cursor:default}.dshSxng_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5}.dshSxng_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.dshSxng_input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}.dshSxng_inputInvalid{border-color:var(--dsw-alias-label-error);}.dshSxng_invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5}.dshSxng_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}";
		const tagId = "@deepseek-ai/dsh-web-search-searxng/SearxngCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-web-search-searxng";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const styles = {
			"badge": "dshSxng_badge",
			"badgeMuted": "dshSxng_badgeMuted",
			"badges": "dshSxng_badges",
			"body": "dshSxng_body",
			"card": "dshSxng_card",
			"cardOpen": "dshSxng_cardOpen",
			"chevron": "dshSxng_chevron",
			"chevronOpen": "dshSxng_chevronOpen",
			"description": "dshSxng_description",
			"discard": "dshSxng_discard",
			"failed": "dshSxng_failed",
			"field": "dshSxng_field",
			"footer": "dshSxng_footer",
			"head": "dshSxng_head",
			"headText": "dshSxng_headText",
			"header": "dshSxng_header",
			"hint": "dshSxng_hint",
			"input": "dshSxng_input",
			"inputInvalid": "dshSxng_inputInvalid",
			"invalid": "dshSxng_invalid",
			"label": "dshSxng_label",
			"name": "dshSxng_name",
			"pending": "dshSxng_pending",
			"readOnly": "dshSxng_readOnly",
			"reset": "dshSxng_reset",
			"save": "dshSxng_save"
		};
		//#endregion
		//#region class-name joiner (the inlined clsx equivalent the preset ships)
		/** Join truthy class names with single spaces. @param parts - class parts. @returns the joined class string. */
		function cx(...parts) {
			return parts.filter((part) => part !== false && part !== undefined && part !== null && part !== "").join(" ");
		}
		//#endregion
		//#region card-form (staged form model over the settings namespace)
		/**
		 * Staged form model behind a plugin card.
		 *
		 * A card stages what the user types and writes it only when they save.
		 * Each settings write is a durable, revision-fenced document mutation,
		 * so staged text makes what is on screen exactly what a save would
		 * store. A field shows its effective value — the user layer over the
		 * composition layer over the schema default — and whether the user
		 * layer carries it: that PRESENCE, not a value comparison, is what
		 * marks a field overridden.
		 */
		/**
		 * A whole-number field. An empty draft clears the field; any other
		 * draft that is not a finite number blocks the save.
		 * @param field - field name inside the namespace section.
		 * @returns the field's conversion spec.
		 */
		function numberField(field) {
			return {
				field,
				format: (value) => (typeof value === "number" ? String(value) : ""),
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					const parsed = Number(trimmed);
					return Number.isFinite(parsed) ? { kind: "set", value: parsed } : undefined;
				}
			};
		}
		/**
		 * A free-text field. An empty draft clears the field, so emptying the
		 * control and saving is the same gesture as resetting it.
		 * @param field - field name inside the namespace section.
		 * @returns the field's conversion spec.
		 */
		function textField(field) {
			return {
				field,
				format: (value) => (typeof value === "string" ? value : ""),
				parse: (text) => {
					const trimmed = text.trim();
					return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
				}
			};
		}
		/**
		 * Stages the namespace's edits and plans its save writes, through the
		 * bound settings scope's revision-fenced write path.
		 *
		 * Publishes through a snapshot store: the card component reads through
		 * a snapshot selector, and both the scope and the local drafts change
		 * underneath.
		 */
		class CardForm {
			/**
			 * @param scope - the bound settings scope for the form's namespace.
			 * @param specs - the section fields this form edits.
			 * @param secrets - the form's write-only controls, written outside the section.
			 */
			constructor(scope, specs, secrets = []) {
				this.scope = scope;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.secretSpecs = new Map(secrets.map((spec) => [spec.field, spec]));
				this.staged = new Map();
				this.listeners = new Set();
				scope.subscribe(() => {
					this.publish();
				});
			}
			/**
			 * Publish a projection of this form to the card's store.
			 * @param project - build the card's state from the form's current reads.
			 * @returns the store the card's component reads through its bound selector.
			 */
			bind(project) {
				const store = dshStore.createSnapshotStore(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/**
			 * Read one control's state.
			 * @param field - field name of a section field or of a write-only control.
			 * @returns the draft text, whether a save would leave an override, and whether it is invalid.
			 */
			field(field) {
				const staged = this.staged.get(field);
				if (this.secretSpecs.has(field)) {
					return { text: staged?.text ?? "", overridden: false, invalid: false };
				}
				const spec = this.spec(field);
				if (staged === undefined) {
					return {
						text: spec.format(this.sectionValue(field)),
						overridden: this.stored(field),
						invalid: false
					};
				}
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write?.kind === "set",
					invalid: write === undefined
				};
			}
			/**
			 * Stage one edit.
			 * @param field - field name inside the namespace section.
			 * @param text - the draft text.
			 */
			edit(field, text) {
				this.stage(field, { text, clear: false });
			}
			/**
			 * Stage a clear, so saving lets the field re-inherit the composition layer.
			 * @param field - field name inside the namespace section.
			 */
			resetField(field) {
				this.stage(field, {
					text: this.spec(field).format(this.baseValue(field)),
					clear: true
				});
			}
			/** Drop every staged edit (the caller republishes the card state). */
			discard() {
				this.staged.clear();
			}
			/**
			 * Whether the Host serves this namespace as an editable section.
			 * @returns true while the scope holds an accepted section.
			 */
			available() {
				return this.scope.getSnapshot().status === "ready";
			}
			/** @returns whether the Host document accepts writes for this namespace. */
			writable() {
				return this.scope.getSnapshot().writable;
			}
			/**
			 * Every staged edit a save would write. An entry whose draft is not
			 * a value its field accepts carries no write: the form is still
			 * dirty, and the save refuses rather than dropping the edit.
			 * @returns the planned writes, in the order the fields were staged.
			 */
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const secret = this.secretSpecs.get(field);
					if (secret !== undefined) {
						const value = staged.text.trim();
						if (value !== "") plan.push({ field, run: () => secret.write(value) });
						continue;
					}
					const spec = this.spec(field);
					if (staged.clear) {
						if (this.stored(field)) plan.push({ field, run: () => this.clear(field) });
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === undefined) plan.push({ field, run: undefined });
					else if (write.kind === "clear") plan.push({ field, run: () => this.clear(field) });
					else plan.push({ field, run: () => this.store(field, write.value) });
				}
				return plan;
			}
			/**
			 * Clear the user-layer entry so the field re-inherits the composition layer.
			 * @param field - field name inside the namespace section.
			 * @returns whether the Host no longer carries the field.
			 */
			async clear(field) {
				await this.scope.unset(field);
				return !this.stored(field);
			}
			/**
			 * Store one field value through the revision-fenced write path.
			 * @param field - field name inside the namespace section.
			 * @param value - the JSON-shaped value to store.
			 * @returns whether the user layer now holds exactly this value.
			 */
			async store(field, value) {
				await this.scope.set(field, value);
				return this.userLayer()?.[field] === value;
			}
			/**
			 * Stage one edit.
			 * @param field - field name inside the namespace section.
			 * @param edit - the staged draft and whether it clears the field.
			 */
			stage(field, edit) {
				this.staged.set(field, edit);
				this.publish();
			}
			/**
			 * @param field - field name inside the namespace section.
			 * @returns the declared conversion spec for that field.
			 */
			spec(field) {
				const spec = this.specs.get(field);
				if (spec === undefined) throw new Error(`plugin card has no field ${field}`);
				return spec;
			}
			/** @returns the current scope snapshot. */
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			/** @param field - field name. @returns the section's resolved value for it. */
			sectionValue(field) {
				return this.snapshotOf().value?.[field];
			}
			/** @param field - field name. @returns the composition base's value for it. */
			baseValue(field) {
				return this.snapshotOf().base?.[field];
			}
			/** @returns the raw user layer, when one exists. */
			userLayer() {
				return this.snapshotOf().user;
			}
			/** @param field - field name. @returns whether the user layer carries it. */
			stored(field) {
				const user = this.userLayer();
				return user !== undefined && Object.hasOwn(user, field);
			}
			/** Republish every bound projection from the form's current reads. */
			publish() {
				for (const listener of this.listeners) listener();
			}
		}
		//#endregion
		//#region card-controller (the settings scope + the credentials domain)
		/**
		 * The card's bridge between the `web-search-searxng` settings section
		 * and the credentials domain.
		 *
		 * The key is the one control that does not live in the section: its
		 * literal never rides a response, so the card learns only whether one
		 * is configured and writes it through the credentials domain,
		 * addressed by the reference the section names. The key is staged with
		 * the rest of the form, so one save covers everything shown.
		 */
		/**
		 * Namespace of the DeepSeek provider's user-owned settings. Spelled
		 * here rather than imported: a client package must not depend on a
		 * Host package.
		 */
		const DEEPSEEK_NS = "web-search-deepseek";
		/** Namespace of this plugin's user-owned settings. */
		const SEARXNG_NS = "web-search-searxng";
		/** Credential reference this provider resolves when the section names none. */
		const SEARXNG_DEFAULT_KEY_REF = "SEARXNG_API_KEY";
		/** Form field the credential control stages under. */
		const API_KEY_FIELD = "apiKey";
		/** Bridges the settings section and the credentials domain onto one card. */
		class SearxngCardController {
			/**
			 * @param scope - bound scope of the `web-search-searxng` namespace.
			 * @param remote - the remote facade whose credentials namespace answers for the credential the section references.
			 */
			constructor(scope, remote) {
				this.remote = remote;
				this.form = new CardForm(scope, [
					textField("baseURL"),
					numberField("maxResults"),
					textField("language"),
					], [
					{ field: API_KEY_FIELD, write: (text) => this.writeKey(text) }
				]);
				this.credentials = { ref: "", configured: false, writable: true };
				this.saving = false;
				this.failed = false;
				this.store = this.form.bind(() => this.projection());
				// The section can re-point its key (an `apiKeyEnv` write, or the
				// first acceptance naming a non-default reference), so every
				// scope change re-checks which reference is in force.
				scope.subscribe(() => {
					void this.readCredentials();
				});
				void this.readCredentials();
			}
			/** @returns the card state the component renders. */
			projection() {
				const plan = this.form.available() ? this.form.plan() : [];
				return {
					available: this.form.available(),
					writable: this.form.writable(),
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === undefined),
					saving: this.saving,
					failed: this.failed,
					baseURL: this.form.field("baseURL"),
					maxResults: this.form.field("maxResults"),
					language: this.form.field("language"),
					apiKey: this.form.field(API_KEY_FIELD),
					apiKeyConfigured: this.credentials.configured,
					apiKeyWritable: this.credentials.writable
				};
			}
			/**
			 * Ask the credentials domain about the reference.
			 *
			 * The answer is stored with the reference it describes: the
			 * section's `apiKeyEnv` can change between request and response,
			 * and reads can settle out of order, so a response is published
			 * only while it still answers for the reference in force.
			 */
			async readCredentials() {
				const ref = this.keyRef();
				if (ref !== this.credentials.ref) {
					// A new reference knows nothing yet; keeping the old answer
					// would claim a key is configured under a name not checked.
					this.credentials = { ref, configured: false, writable: true };
					this.publishCard();
				}
				let response;
				try {
					response = await this.remote.credentials.describe([ref]);
				} catch (_credentialReadFailure) {
					// The card stays usable without this: the key control reports
					// the last state it knew, and a write still reaches the Host.
					return;
				}
				if (!response.ok) return;
				// Staleness: the section may have re-pointed while in flight.
				if (this.keyRef() !== ref) return;
				const view = response.value[ref];
				// An unknown reference stays writable: the control remains
				// usable and the Host is what refuses, not the card guessing.
				const next = {
					configured: view?.configured ?? false,
					writable: view?.writable ?? true
				};
				if (next.configured === this.credentials.configured && next.writable === this.credentials.writable) return;
				Object.assign(this.credentials, next);
				this.publishCard();
			}
			/**
			 * Re-read after the Host reports a change to the watched reference.
			 *
			 * A key can be written from somewhere else and the settings
			 * section does not change when it is, so without this a badge
			 * keeps reporting a state the Host already replaced.
			 * @param ref - the reference the Host reports as changed.
			 */
			refreshCredential(ref) {
				if (ref !== this.credentials.ref) return;
				void this.readCredentials();
			}
			/**
			 * Build the face the card's slot registrations inject.
			 * @returns the card's snapshot and its form actions.
			 */
			inject() {
				return {
					hooks: { webSearchCard: this.store },
					edit: (field, text) => {
						this.failed = false;
						this.form.edit(field, text);
					},
					resetField: (field) => {
						this.failed = false;
						this.form.resetField(field);
					},
					onSave: () => {
						void this.save();
					},
					onDiscard: () => {
						this.discard();
					}
				};
			}
			/**
			 * Write every staged edit, then re-seed from what the Host accepted.
			 *
			 * Each field is its own revision-fenced document mutation; the save
			 * runs every planned write and reads each back. A save that did not
			 * land keeps its drafts, so the user can correct them instead of
			 * retyping.
			 */
			async save() {
				const plan = this.form.available() ? this.form.plan() : [];
				const writes = plan.flatMap((item) => (item.run === undefined ? [] : [item.run]));
				if (plan.length === 0 || this.saving || writes.length !== plan.length) return;
				this.saving = true;
				this.failed = false;
				this.publishCard();
				let landed = true;
				for (const write of writes) landed = (await write()) && landed;
				if (landed) this.form.discard();
				this.saving = false;
				this.failed = !landed;
				this.publishCard();
			}
			/**
			 * Drop every staged edit.
			 */
			discard() {
				const plan = this.form.available() ? this.form.plan() : [];
				if (plan.length === 0 && !this.failed) return;
				this.form.discard();
				this.failed = false;
				this.publishCard();
			}
			/**
			 * The credential reference the section names, or its default.
			 * @returns the reference to address.
			 */
			keyRef() {
				const snapshot = this.form.snapshotOf();
				if (snapshot.status !== "ready") return SEARXNG_DEFAULT_KEY_REF;
				const declared = snapshot.value?.apiKeyEnv;
				return declared !== undefined && declared.length > 0 ? declared : SEARXNG_DEFAULT_KEY_REF;
			}
			/**
			 * Write the staged key, then re-read whether the Host now holds one.
			 * @param value - the staged credential literal.
			 * @returns whether the Host reports a configured credential afterwards.
			 */
			async writeKey(value) {
				const ref = this.keyRef();
				try {
					await this.remote.credentials.set(ref, value);
				} catch (_credentialWriteFailure) {
					// Refusals surface through the re-read below: the Host is
					// the only authority on whether the key now exists.
				}
				await this.readCredentials();
				return this.credentials.configured;
			}
			/** Republish the card projection from the current reads. */
			publishCard() {
				this.store.set(this.projection());
			}
		}
		//#endregion
		//#region fields (hand-written controls for the card form)
		/**
		 * A staged value field. `numeric` only hints the keypad: which drafts a
		 * field accepts is decided by its spec, so the control never silently
		 * rewrites what the user typed.
		 * @param props - the field's copy, its staged text, and the edit actions.
		 * @returns the labelled control.
		 */
		function ValueField(props) {
			return (0, reactJsx.jsxs)("div", {
				className: styles.field,
				children: [
					(0, reactJsx.jsxs)("div", {
						className: styles.head,
						children: [(0, reactJsx.jsx)("label", {
							className: styles.label,
							htmlFor: props.id,
							children: props.label
						}), props.overridden ? (0, reactJsx.jsxs)("span", {
							className: styles.badges,
							children: [(0, reactJsx.jsx)("span", {
								className: styles.badge,
								children: props.overriddenLabel
							}), (0, reactJsx.jsx)("button", {
								type: "button",
								className: styles.reset,
								disabled: props.disabled,
								onClick: props.onReset,
								children: props.resetLabel
							})]
						}) : null]
					}),
					(0, reactJsx.jsx)("input", {
						id: props.id,
						className: props.invalid ? styles.inputInvalid : styles.input,
						type: "text",
						...props.numeric === true ? { inputMode: "numeric" } : {},
						...props.invalid ? { "aria-invalid": true } : {},
						value: props.text,
						placeholder: props.placeholder ?? "",
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					(0, reactJsx.jsx)("p", {
						className: props.invalid ? styles.invalid : styles.hint,
						children: props.invalid ? props.invalidLabel : props.hint
					})
				]
			});
		}
		/**
		 * A write-only credential control. The value never rides a response, so
		 * the control reports only whether one is configured and starts blank;
		 * a blank draft writes nothing, which keeps the stored key rather than
		 * clearing it.
		 * @param props - the field's copy, its staged text, and the configured state.
		 * @returns the labelled control.
		 */
		function SecretField(props) {
			return (0, reactJsx.jsxs)("div", {
				className: styles.field,
				children: [
					(0, reactJsx.jsxs)("div", {
						className: styles.head,
						children: [(0, reactJsx.jsx)("label", {
							className: styles.label,
							htmlFor: props.id,
							children: props.label
						}), (0, reactJsx.jsx)("span", {
							className: styles.badges,
							children: (0, reactJsx.jsx)("span", {
								className: props.configured ? styles.badge : styles.badgeMuted,
								children: props.stateLabel
							})
						})]
					}),
					(0, reactJsx.jsx)("input", {
						id: props.id,
						className: styles.input,
						type: "password",
						autoComplete: "off",
						value: props.text,
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					(0, reactJsx.jsx)("p", {
						className: styles.hint,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region SearxngCard (the web-search card, SearXNG edition)
		/**
		 * The Web-search card: the shipped card's chrome — a header naming the
		 * surface, the fields, the one Save that writes them — with its texts
		 * naming the SearXNG provider this deployment searches through.
		 * Disclosure is card-local state; staged edits outlive collapsing, so
		 * the header marks a card holding unsaved edits.
		 *
		 * The card renders nothing while the SearXNG namespace is unavailable —
		 * this bundle loads only when the owning plugin is composed, and a
		 * deployment without its section should show no trace of it.
		 *
		 * @param props - the locale copy, the card snapshot, and its form actions.
		 * @returns the card, or nothing when no section is available.
		 */
		function SearxngCard(props) {
			const [open, setOpen] = react.useState(false);
			const { t } = props;
			const state = props.useWebSearchCard((snapshot) => snapshot);
			if (!state.available) return null;
			const blocked = !state.dirty || state.invalid || state.saving;
			const disabled = !state.writable;
			return (0, reactJsx.jsxs)("li", {
				className: cx(styles.card, open && styles.cardOpen),
				children: [(0, reactJsx.jsxs)("button", {
					type: "button",
					className: styles.header,
					"aria-expanded": open,
					"aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						(0, reactJsx.jsxs)("span", {
							className: styles.headText,
							children: [(0, reactJsx.jsx)("span", {
								className: styles.name,
								children: t("title")
							}), (0, reactJsx.jsx)("span", {
								className: styles.description,
								children: t("description")
							})]
						}),
						state.dirty ? (0, reactJsx.jsx)("span", {
							className: styles.pending,
							children: t("unsaved")
						}) : null,
						(0, reactJsx.jsx)(primitives.IconChevronDownOutline14, {
							className: cx(styles.chevron, open && styles.chevronOpen)
						})
					]
				}), open ? (0, reactJsx.jsxs)("div", {
					className: styles.body,
					children: [
						!state.writable ? (0, reactJsx.jsx)("p", {
							className: styles.readOnly,
							role: "status",
							children: t("readOnly")
						}) : null,
						(0, reactJsx.jsx)(SecretField, {
							id: "plugin-config-web-search-searxng-key",
							label: t("apiKey"),
							hint: t("apiKeyHint"),
							disabled: !state.apiKeyWritable,
							text: state.apiKey.text,
							configured: state.apiKeyConfigured,
							stateLabel: state.apiKeyConfigured ? t("apiKeySet") : t("apiKeyUnset"),
							onEdit: (text) => {
								props.edit("apiKey", text);
							}
						}),
						(0, reactJsx.jsx)(ValueField, {
							id: "plugin-config-web-search-searxng-endpoint",
							label: t("baseURL"),
							hint: t("baseURLHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							invalidLabel: t("invalidNumber"),
							disabled,
							...state.baseURL,
							onEdit: (text) => {
								props.edit("baseURL", text);
							},
							onReset: () => {
								props.resetField("baseURL");
							}
						}),
						(0, reactJsx.jsx)(ValueField, {
							id: "plugin-config-web-search-searxng-max-results",
							label: t("maxResults"),
							hint: t("maxResultsHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							invalidLabel: t("invalidNumber"),
							numeric: true,
							disabled,
							...state.maxResults,
							onEdit: (text) => {
								props.edit("maxResults", text);
							},
							onReset: () => {
								props.resetField("maxResults");
							}
						}),
						(0, reactJsx.jsx)(ValueField, {
							id: "plugin-config-web-search-searxng-language",
							label: t("language"),
							hint: t("languageHint"),
							overriddenLabel: t("overridden"),
							resetLabel: t("reset"),
							invalidLabel: t("invalidNumber"),
							disabled,
							...state.language,
							onEdit: (text) => {
								props.edit("language", text);
							},
							onReset: () => {
								props.resetField("language");
							}
						}),
												(0, reactJsx.jsxs)("div", {
							className: styles.footer,
							children: [
								state.failed ? (0, reactJsx.jsx)("p", {
									className: styles.failed,
									role: "status",
									children: t("saveFailed")
								}) : null,
								(0, reactJsx.jsx)("button", {
									type: "button",
									className: styles.discard,
									disabled: !state.dirty || state.saving,
									onClick: props.onDiscard,
									children: t("discard")
								}),
								(0, reactJsx.jsx)("button", {
									type: "button",
									className: styles.save,
									disabled: blocked,
									onClick: props.onSave,
									children: t(state.saving ? "saving" : "save")
								})
							]
						})
					]
				}) : null]
			});
		}
		/**
		 * The shadowing cell. Registered under the shipped card's key at
		 * priority -1, so the keyed dispatch wins with it instead of the
		 * shipped card: the DeepSeek section keeps its seat but shows no card.
		 * It renders nothing and carries no inject face for the same reason.
		 * @returns nothing.
		 */
		function SearxngTombstone() {
			return null;
		}
		//#endregion
		//#region locales
		/** Locale dictionaries for the Web-search card (the shipped card's texts, naming SearXNG). */
		/** English copy. */
		const en = {
			title: "SearXNG",
			description: "The SearXNG meta-search provider.",
			apiKey: "API key",
			apiKeyHint: "Stored outside the settings file. Leave blank to keep the current key. A key is optional for keyless instances.",
			apiKeySet: "A key is configured.",
			apiKeyUnset: "No key is configured.",
			baseURL: "Endpoint",
			baseURLHint: "SearXNG base URL. Leave blank to use the provider default.",
			maxResults: "Max results",
			maxResultsHint: "Upper bound on sources returned by one search. Leave blank for the default.",
			language: "Language",
			languageHint: "Search language, or 'all' for no preference.",
									overridden: "Overridden",
			reset: "Reset to default",
			readOnly: "This deployment stores settings read-only.",
			expand: "Show settings",
			collapse: "Hide settings",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			unsaved: "Unsaved",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			invalidNumber: "Enter a number, or leave blank to use the default."
		};
		/** Simplified Chinese copy. */
		const zh = {
			title: "SearXNG",
			description: "SearXNG 元搜索提供方。",
			apiKey: "API 密钥",
			apiKeyHint: "不写入设置文件。留空表示保持当前密钥。无密钥的实例可以不填。",
			apiKeySet: "已配置密钥。",
			apiKeyUnset: "未配置密钥。",
			baseURL: "接口地址",
			baseURLHint: "SearXNG 基础地址。留空则使用提供方默认地址。",
			maxResults: "最多结果数",
			maxResultsHint: "一次搜索返回来源的上限。留空表示使用默认值。",
			language: "语言",
			languageHint: "搜索语言，填 'all' 表示不限。",
									overridden: "已覆盖",
			reset: "恢复默认",
			readOnly: "本部署的设置为只读。",
			expand: "展开设置",
			collapse: "收起设置",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			unsaved: "未保存",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			invalidNumber: "请填数字；留空表示使用默认值。"
		};
		//#endregion
		//#region plugin face
		/** Dictionary namespace owned by this plugin. */
		const NS = "web-search-searxng";
		/** Required services (cordis fiber inject). */
		const inject = ["slots", "locale", "remote", "remote.credentials", "settingsScope"];
		/**
		 * Mount the SearXNG web-search card.
		 *
		 * Two entries into the shared `settings.plugin.item` slot:
		 * - under `web-search-deepseek` at priority -1, a null-rendering
		 *   tombstone shadowing the card the harness ships for that namespace
		 *   (keyed slots render the lowest priority), so that section shows no
		 *   card of its own;
		 * - under `web-search-searxng`, the card itself, rendered whenever the
		 *   section is available.
		 * The tab dispatches a key only when the Host serves its namespace, so
		 * a deployment missing this plugin shows no trace of the card either
		 * way.
		 * @param ctx - the browser plugin context.
		 */
		function apply(ctx) {
			ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "web-search-searxng: card dictionaries");
			const controller = new SearxngCardController(
				ctx.settingsScope.bind({ namespace: SEARXNG_NS }),
				ctx.remote
			);
			ctx.effect(() => ctx.remote.$on("credentials/reference-updated", (ref) => {
				controller.refreshCredential(ref);
			}), "web-search-searxng: credential invalidations");
			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: DEEPSEEK_NS,
					priority: -1,
					locale: NS
				}, SearxngTombstone);
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: SEARXNG_NS,
					locale: NS,
					inject: () => controller.inject()
				}, SearxngCard);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
