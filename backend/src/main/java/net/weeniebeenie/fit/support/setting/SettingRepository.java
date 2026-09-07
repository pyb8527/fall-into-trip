package net.weeniebeenie.fit.support.setting;

import net.weeniebeenie.fit.support.setting.Setting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SettingRepository extends JpaRepository<Setting, String> {
}
