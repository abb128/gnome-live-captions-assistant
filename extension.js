/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const { GLib, Gio, Shell } = imports.gi;

class Extension {
    constructor() {
    }

    updateKeepAbove(value) {
        const appSystem = Shell.AppSystem.get_default();

        let app = appSystem.lookup_desktop_wmclass("livecaptions") ?? appSystem.lookup_desktop_wmclass("net.sapples.LiveCaptions");
        if(app === null){
            for(let a of appSystem.get_running()) {
                const wmclass = a.get_windows()[0].wm_class.toLowerCase();;
                if((wmclass === "livecaptions") || (wmclass === "net.sapples.livecaptions")){
                    app = a;
                    break;
                }
            }
        }

        if(app === null){
            log("Could not find livecaptions application");
            return;
        }

        const windows = app.get_windows();

        windows.forEach(window => {
            if(value) window.make_above(); else window.unmake_above();
        });
    }

    subscribeToProperty(connection) {
        this.signalId = connection.signal_subscribe(
            "net.sapples.LiveCaptions",
            "org.freedesktop.DBus.Properties",
            "PropertiesChanged",
            "/net/sapples/LiveCaptions/External",
            null,
            Gio.DBusSignalFlags.NONE,
            (connection_, name_, object_, interface_, signal_, parameters) => {
                const pars = parameters.recursiveUnpack();

                const properties = pars[1];

                if("KeepAbove" in properties) {
                    const keepAbove = properties["KeepAbove"];
                    this.updateKeepAbove(keepAbove);
                }
            }
        );
        this.previousConnection = connection;
    }

    onNameAppeared(connection, name, name_owner) {
        connection.call(
            "net.sapples.LiveCaptions",
            "/net/sapples/LiveCaptions/External",
            "net.sapples.LiveCaptions.External",
            "AllowKeepAbove",
            null,
            null,
            Gio.DBusCallFlags.NO_AUTO_START,
            -1,
            null
        ).then((v) => {
            
        }).catch((e) => {
            logError(e);
        });

        const getPropertyInfo = new GLib.Variant('(ss)', [
            "net.sapples.LiveCaptions.External",
            "KeepAbove"
        ]);
        connection.call(
            "net.sapples.LiveCaptions",
            "/net/sapples/LiveCaptions/External",
            "org.freedesktop.DBus.Properties",
            "Get",
            getPropertyInfo,
            null,
            Gio.DBusCallFlags.NO_AUTO_START,
            -1,
            null
        ).then((v) => {
            const keepAbove = v.recursiveUnpack();
            this.updateKeepAbove(keepAbove[0]);
        }).catch((e) => {
            logError(e);
        });

        this.subscribeToProperty(connection);
    }

    onNameVanished(connection, name) {
        if(this.signalId != -1) {
            connection.signal_unsubscribe(this.signalId);
            this.signalId = -1;
        }
    }

    enable() {
        this.previousConnection = null;
        this.signalId = -1;
        this.busWatchId = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            'net.sapples.LiveCaptions',
            Gio.BusNameWatcherFlags.NONE,
            (connection, name, owner) => this.onNameAppeared(connection, name, owner),
            (connection, name) => this.onNameVanished(connection, name)
        );
    }

    disable() {
        Gio.bus_unwatch_name(this.busWatchId);

        if((this.previousConnection !== null) && (this.signalId != -1)){
            this.previousConnection.signal_unsubscribe(this.signalId);
            this.previousConnection = null;
            this.signalId = -1;
        }
    }
}

function init() {
    return new Extension();
}
